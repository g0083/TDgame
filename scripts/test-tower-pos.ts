/* Renders a single tower on a blank field and reports where its ink lands. */
/* eslint-disable no-console */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const PORT = 4191
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

async function serve(): Promise<() => Promise<void>> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let p = decodeURIComponent(url.pathname)
    if (p === '/') p = '/index.html'
    const file = join(DIST, normalize(p).replace(/^(\.\.[/\\])+/, ''))
    const s = await stat(file).catch(() => null)
    if (!s || !s.isFile()) {
      res.writeHead(404)
      res.end('nf')
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  })
  await new Promise<void>((r) => server.listen(PORT, r))
  return () => new Promise<void>((r) => server.close(() => r()))
}

const CELL = 40
const BASE = `http://localhost:${PORT}/`

type Win = { aegis?: { battleView?: { battleRef: { pathCells: Set<number>; canBuild: (c: number, r: number) => boolean }; stop: () => void; renderer?: { debugDrawTowersOnly: (b: unknown) => void } } } }

async function main(): Promise<void> {
  const stop = await serve()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.setDefaultTimeout(12000)

  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.locator('#screen-title .menu-list .btn').first().click()
  await page.waitForTimeout(400)
  await page.locator('#screen-stages .stage-card').first().click()
  await page.waitForTimeout(1200)
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.speed-toggle')?.click())

  // find a buildable cell near the middle of the map
  const cell = (await page.evaluate(() => {
    const b = (window as unknown as Win).aegis?.battleView?.battleRef
    if (!b) return null
    for (const k of b.pathCells) {
      const c = k % 12
      const r = Math.floor(k / 12)
      for (const [cc, rr] of [
        [c, r - 1],
        [c, r + 1],
        [c - 1, r],
        [c + 1, r],
      ] as [number, number][]) {
        if (cc >= 3 && cc <= 8 && rr >= 3 && rr <= 12 && b.canBuild(cc, rr)) return { c: cc, r: rr }
      }
    }
    return null
  })) as { c: number; r: number } | null

  if (!cell) throw new Error('no buildable cell')
  const ex = cell.c * CELL + CELL / 2
  const ey = cell.r * CELL + CELL / 2
  console.log(`cell r${cell.r} c${cell.c}  expected centre (${ex}, ${ey})`)

  await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>('.tower-btn')[0]?.click())
  const box = (await page.locator('#game-canvas').boundingBox())!
  await page.mouse.click(box.x + (ex / 480) * box.width, box.y + (ey / 640) * box.height)
  await page.waitForTimeout(500)

  // report what the game thinks the tower positions are
  const towers = (await page.evaluate(() => {
    const b = (window as unknown as { aegis?: { battleView?: { battleRef: { towers: unknown[] } } } }).aegis
      ?.battleView?.battleRef
    return (b?.towers ?? []).map((t) => {
      const x = t as { x: number; y: number; c: number; r: number; type: string }
      return { x: x.x, y: x.y, c: x.c, r: x.r, type: x.type }
    })
  })) as { x: number; y: number; c: number; r: number; type: string }[]
  console.log('towers in sim:', JSON.stringify(towers))

  // blank field + tower layer only
  await page.evaluate(() => {
    const bv = (window as unknown as Win).aegis?.battleView
    bv?.stop()
    bv?.renderer?.debugDrawTowersOnly(bv!.battleRef)
  })
  await page.waitForTimeout(150)

  // scan the WHOLE canvas so the measurement cannot miss the ink
  const whole = (await page.evaluate(() => {
    const cv = document.getElementById('game-canvas') as HTMLCanvasElement
    const dpr = cv.width / parseFloat(cv.style.width)
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4
        if (d[i] + d[i + 1] + d[i + 2] > 30) {
          n++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null
    return { minX: minX / dpr, minY: minY / dpr, maxX: maxX / dpr, maxY: maxY / dpr, n }
  })) as { minX: number; minY: number; maxX: number; maxY: number; n: number } | null
  console.log('whole-canvas ink:', JSON.stringify(whole))

  // measure the ink, converting CSS pixels back into FIELD coordinates
  // (the canvas is scaled to fit the screen, so css != field)
  const m = (await page.evaluate(() => {
    const cv = document.getElementById('game-canvas') as HTMLCanvasElement
    const cssW = parseFloat(cv.style.width)
    const cssH = parseFloat(cv.style.height)
    const dpr = cv.width / cssW
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4
        if (d[i] + d[i + 1] + d[i + 2] > 30) {
          n++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null
    // back to field units
    const sx = 480 / cssW
    const sy = 640 / cssH
    return {
      minX: (minX / dpr) * sx,
      minY: (minY / dpr) * sy,
      maxX: (maxX / dpr) * sx,
      maxY: (maxY / dpr) * sy,
      n,
    }
  })) as { minX: number; minY: number; maxX: number; maxY: number; n: number } | null

  if (!m) {
    console.log('FAIL: nothing rendered')
    process.exitCode = 1
  } else {
    const cx = (m.minX + m.maxX) / 2
    const cy = (m.minY + m.maxY) / 2
    const dx = cx - ex
    const dy = cy - ey
    const w = m.maxX - m.minX
    const h = m.maxY - m.minY
    console.log(`ink bbox  : ${w.toFixed(1)} x ${h.toFixed(1)} field px  (pad is 34 x 34)`)
    console.log(`ink centre: (${cx.toFixed(1)}, ${cy.toFixed(1)}) field px`)
    console.log(`expected  : (${ex}, ${ey}) field px`)
    console.log(`offset    : dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`)
    // the arrow icon's ink is not perfectly square, so only assert that the
    // centre lands on the cell and that the box is not larger than the pad
    const pass = Math.abs(dx) <= 3 && Math.abs(dy) <= 3 && w <= 36 && h <= 36
    console.log(pass ? 'RESULT: PASS - icon is centred' : 'RESULT: FAIL - icon is offset')
    if (!pass) process.exitCode = 1
  }

  // now overlay a red cell outline (after measuring) and save a screenshot
  await page.evaluate(
    ({ ex, ey }) => {
      const cv = document.getElementById('game-canvas') as HTMLCanvasElement
      const cssW = parseFloat(cv.style.width)
      const dpr = cv.width / cssW
      const ctx = cv.getContext('2d')!
      ctx.setTransform(dpr * (cssW / 480), 0, 0, dpr * (parseFloat(cv.style.height) / 640), 0, 0)
      ctx.strokeStyle = '#ff3b6b'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 5])
      ctx.strokeRect(ex - 20, ey - 20, 40, 40)
      ctx.setLineDash([])
    },
    { ex, ey },
  )
  await page.waitForTimeout(100)
  await page.screenshot({ path: 'dist-test/tower-pos.png' })

  await browser.close()
  await stop()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

