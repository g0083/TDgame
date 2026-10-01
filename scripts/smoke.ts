/* Browser smoke test: boots the built app, plays a bit, checks PWA wiring. */
/* eslint-disable no-console */
import { chromium, type ConsoleMessage } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const PORT = 4188

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

async function serve(): Promise<() => Promise<void>> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      let p = decodeURIComponent(url.pathname)
      if (p === '/') p = '/index.html'
      const file = join(DIST, normalize(p).replace(/^(\.\.[/\\])+/, ''))
      const s = await stat(file).catch(() => null)
      if (!s || !s.isFile()) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch (e) {
      res.writeHead(500)
      res.end(String(e))
    }
  })
  await new Promise<void>((r) => server.listen(PORT, r))
  return () =>
    new Promise<void>((r) => {
      server.close(() => r())
    })
}

const errors: string[] = []
const URL_BASE = `http://localhost:${PORT}/`

async function main(): Promise<void> {
  const stop = await serve()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

  await page.goto(URL_BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1200)

  console.log('title logo:', await page.textContent('#screen-title .logo'))
  console.log('menu buttons:', await page.locator('#screen-title .menu-list .btn').count())

  await page.locator('#screen-title .menu-list .btn').first().click()
  await page.waitForTimeout(400)
  console.log('stage cards:', await page.locator('#screen-stages .stage-card').count())
  await page.locator('#screen-stages .stage-card').first().click()
  await page.waitForTimeout(900)

  const canvasBox = await page.locator('#game-canvas').boundingBox()
  console.log('canvas box:', canvasBox)
  console.log('build bar buttons:', await page.locator('.build-bar .tower-btn').count())
  console.log('ability buttons:', await page.locator('.ability-btn').count())
  console.log('info button:', await page.locator('.build-info-btn').count())
  // long-press a tower button → details, without selecting it for building
  const firstBtn = page.locator('.build-bar .tower-btn').first()
  const bb = await firstBtn.boundingBox()
  if (bb) {
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(600)
    await page.mouse.up()
    await page.waitForTimeout(400)
    console.log('long-press opened detail:', await page.locator('.sheet.show').count())
    console.log('no build selection leaked:', await page.locator('.tower-btn.selected').count())
    await page.screenshot({ path: 'dist-test/smoke-longpress.png' })
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.sheet-head .btn.icon-btn')?.click())
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: 'dist-test/smoke-buildbar.png' })

  // ── tower reference must be readable BEFORE building anything ──
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.build-info-btn')?.click())
  await page.waitForTimeout(400)
  console.log('info sheet open:', await page.locator('.sheet.show').count())
  console.log('info rows:', await page.locator('.info-row').count())
  await page.screenshot({ path: 'dist-test/smoke-tower-list.png' })
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.info-row')?.click())
  await page.waitForTimeout(400)
  console.log('tower detail rows:', await page.locator('.lvl-row').count())
  console.log('trait chips:', await page.locator('.sheet .tag').count())
  console.log('description len:', ((await page.textContent('.sheet-desc')) ?? '').length)
  console.log('evo branches:', await page.locator('.evo-card').count())
  await page.screenshot({ path: 'dist-test/smoke-tower-detail.png' })
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.sheet-head .btn.icon-btn')?.click())
  await page.waitForTimeout(300)
  console.log('sheet closed:', (await page.locator('.sheet.show').count()) === 0)

  await page.locator('.build-bar .tower-btn').first().click({ force: true })
  const clickField = async (fx: number, fy: number) => {
    if (!canvasBox) return
    await page.mouse.click(canvasBox.x + canvasBox.width * fx, canvasBox.y + canvasBox.height * fy)
    await page.waitForTimeout(250)
  }
  // build a few towers around the path
  await clickField(0.42, 0.5)
  await clickField(0.55, 0.3)
  await page.evaluate(() => {
    document.querySelectorAll<HTMLButtonElement>('.tower-btn')[2]?.click()
  })
  await clickField(0.6, 0.6)
  // tapping the same cell again with no build tool selected opens the tower sheet
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('.tower-btn.selected')?.click()
  })
  await clickField(0.42, 0.5)
  await page.waitForTimeout(400)
  const sheetCount = await page.locator('.sheet.show').count()
  console.log('tower sheet open:', sheetCount)
  if (sheetCount > 0) {
    console.log('sheet title:', await page.textContent('.sheet-head strong'))
    const upgrade = page.locator('.sheet-actions .btn.primary').first()
    console.log('upgrade button present:', await upgrade.count())
    if (await upgrade.count()) {
      console.log('upgrade enabled:', await upgrade.isEnabled())
      if (await upgrade.isEnabled()) {
        await upgrade.click()
        await page.waitForTimeout(300)
      }
      console.log('stat rows:', await page.locator('.stat-grid div').count())
    }
  }
  await page.locator('.sheet .btn.icon-btn').first().click().catch(() => {})
  await page.waitForTimeout(200)

  // start waves and let them resolve (JS clicks: the HUD re-renders every frame)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const wb = document.querySelector<HTMLButtonElement>('.wave-btn')
      if (wb && !wb.disabled) wb.click()
    })
    await page.waitForTimeout(3000)
  }
  console.log('wave label:', await page.textContent('.wave-label'))
  console.log('gold:', await page.textContent('.stat.gold span:nth-child(2)'))
  console.log('lives:', await page.textContent('.stat.lives span:nth-child(2)'))
  console.log('towers placed (banner check):', await page.evaluate(() => (window as any).aegis ? 'app-exposed' : 'n/a'))

  const painted = await page.evaluate(() => {
    const cv = document.getElementById('game-canvas') as HTMLCanvasElement
    const c = cv.getContext('2d')!
    const d = c.getImageData(0, 0, cv.width, cv.height).data
    const colors = new Set<string>()
    for (let i = 0; i < d.length; i += 4 * 977) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`)
    return colors.size
  })
  console.log('distinct canvas colors:', painted)

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported'
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    return reg ? 'ready' : 'none'
  })
  console.log('service worker:', swState)
  const manifest = await page.evaluate(async () => {
    const res = await fetch('./manifest.webmanifest')
    return res.ok ? (await res.json()).short_name : 'missing'
  })
  console.log('manifest short_name:', manifest)

  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'load' }).catch((e) => errors.push(`offline reload: ${e.message}`))
  await page.waitForTimeout(1500)
  console.log('offline title logo:', await page.textContent('#screen-title .logo').catch(() => null))
  await ctx.setOffline(false)


  for (const [label, index] of [
    ['lab', 4],
    ['codex', 5],
    ['achievements', 6],
    ['settings', 7],
  ] as [string, number][]) {
    await page.goto(URL_BASE, { waitUntil: 'load' })
    await page.waitForTimeout(700)
    await page.locator('#screen-title .menu-list .btn').nth(index).click()
    await page.waitForTimeout(500)
    const title = await page.textContent(`#screen-${label} .screen-title`).catch(() => null)
    const bodyLen = ((await page.textContent(`#screen-${label} .screen-body`)) ?? '').length
    console.log(`screen ${label}: title=${title} bodyLen=${bodyLen}`)
    console.log(`  svg icons rendered:`, await page.locator(`#screen-${label} svg.ico-svg`).count())
    console.log(`  unresolved icon text:`, await page.evaluate((l) => {
      const bad = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u
      const hits: string[] = []
      document.querySelectorAll(`#screen-${l} *`).forEach((el) => {
        for (const c of el.textContent ?? '') if (bad.test(c)) hits.push(c)
      })
      return hits.join('')
    }, label))
    if (label === 'lab' || label === 'codex' || label === 'achievements') {
      await page.screenshot({ path: `dist-test/smoke-svg-${label}.png` })
    }
  }

  await page.goto(URL_BASE, { waitUntil: 'load' })
  await page.waitForTimeout(700)
  await page.locator('#screen-title .menu-list .btn').nth(3).click()
  await page.waitForTimeout(500)
  console.log('daily card:', (await page.textContent('#screen-daily .daily-card h3')) ?? 'none')

  // Grant coins by seeding localStorage *before* the app boots.
  // (Writing it after load would be clobbered by the app's beforeunload save.)
  const richCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  await richCtx.addInitScript(() => {
    localStorage.setItem(
      'aegis-td-save-v1',
      JSON.stringify({
        schema: 1,
        coins: 5000,
        research: {},
        stagesCleared: 3,
        stageStars: {},
        bestWave: 0,
        endlessBest: 12,
        arenaBest: 0,
        dailyBest: 4,
        dailiesDone: 1,
        achievements: [],
        stats: {
          kills: 0, wavesCleared: 0, goldEarned: 0, towersBuilt: 0, bossesKilled: 0,
          maxWave: 0, perfectStages: 0, stagesCleared: 0, playSeconds: 0,
          evolutions: 0, researchSpent: 0, dailiesDone: 0, totalDamage: 0,
        },
        settings: { lang: 'ja', sfx: true, music: true, haptics: true, quality: 'high' },
        lastDaily: null,
        createdAt: Date.now(),
      }),
    )
  })
  const rpage = await richCtx.newPage()
  rpage.setDefaultTimeout(8000)
  await rpage.goto(URL_BASE, { waitUntil: 'load' })
  await rpage.waitForTimeout(900)
  const coinsText = (await rpage.textContent('#screen-title .coins')) ?? '?'
  console.log('coins after seed:', coinsText.replace(/[^0-9]/g, ''))
  await rpage.locator('#screen-title .menu-list .btn').nth(4).click()
  await rpage.waitForTimeout(500)
  const buy = rpage.locator('.research-card .buy').first()
  console.log('lab buy enabled:', await buy.isEnabled())
  if (await buy.isEnabled()) {
    await buy.click()
    await rpage.waitForTimeout(400)
  }
  console.log('rank after buy:', await rpage.textContent('.research-card .body strong'))
  // stage 4 should now be unlocked with stagesCleared = 3
  await rpage.goto(URL_BASE, { waitUntil: 'load' })
  await rpage.waitForTimeout(700)
  await rpage.locator('#screen-title .menu-list .btn').first().click()
  await rpage.waitForTimeout(400)
  console.log('locked stage cards:', await rpage.locator('#screen-stages .stage-card.locked').count())
  await richCtx.close()

  // run the daily challenge end to end with a generous auto-wave
  const dailyCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const dpage = await dailyCtx.newPage()
  dpage.setDefaultTimeout(8000)
  dpage.on('pageerror', (e) => errors.push(`pageerror(daily): ${e.message}`))
  await dpage.goto(URL_BASE, { waitUntil: 'load' })
  await dpage.waitForTimeout(800)
  await dpage.locator('#screen-title .menu-list .btn').nth(3).click()
  await dpage.waitForTimeout(500)
  const startBtn = dpage.locator('#screen-daily .daily-card .btn.primary')
  console.log('daily start enabled:', await startBtn.isEnabled())
  if (await startBtn.isEnabled()) {
    await startBtn.click()
    await dpage.waitForTimeout(1000)
    // build a spread of towers, then auto-fire every wave
    for (let i = 0; i < 5; i++) {
      const bb = await dpage.locator('#game-canvas').boundingBox()
      if (bb) {
        // the build bar is re-rendered periodically, so dispatch the click in-page
        await dpage.evaluate((idx) => {
          document.querySelectorAll<HTMLButtonElement>('.tower-btn')[idx]?.click()
        }, i % 4)
        await dpage.mouse.click(
          bb.x + bb.width * (0.2 + 0.07 * (i % 6)),
          bb.y + bb.height * (0.25 + 0.08 * Math.floor(i / 6)),
        )
        await dpage.waitForTimeout(200)
      }
      // the battle HUD re-renders every frame, so use JS clicks (no actionability wait)
      await dpage.evaluate(() => {
        const auto = document.querySelector<HTMLButtonElement>('.auto-toggle')
        if (auto && !auto.classList.contains('primary')) auto.click()
        const wb = document.querySelector<HTMLButtonElement>('.wave-btn')
        if (wb && !wb.disabled) wb.click()
      })
      await dpage.waitForTimeout(1200)
    }
    console.log('daily wave after run:', await dpage.textContent('.wave-label').catch(() => 'n/a'))
    console.log('daily lives:', await dpage.textContent('.stat.lives span:nth-child(2)').catch(() => 'n/a'))
  }
  await dpage.screenshot({ path: 'dist-test/smoke-daily.png' })
  await dailyCtx.close()

  // force a battle to finish and check the result screen + save write-back
  const finCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const fpage = await finCtx.newPage()
  fpage.setDefaultTimeout(8000)
  fpage.on('pageerror', (e) => errors.push(`pageerror(result): ${e.message}`))
  await fpage.goto(URL_BASE, { waitUntil: 'load' })
  await fpage.waitForTimeout(800)
  await fpage.locator('#screen-title .menu-list .btn').first().click()
  await fpage.waitForTimeout(400)
  await fpage.locator('#screen-stages .stage-card').first().click()
  await fpage.waitForTimeout(900)
  // run at 3x with no towers until the core falls (full path traversal takes ~45s at 1x)
  await fpage.evaluate(() => {
    const sp = document.querySelector<HTMLButtonElement>('.speed-toggle')
    sp?.click()
    sp?.click()
  })
  for (let i = 0; i < 90; i++) {
    if (await fpage.locator('#screen-result.active').count()) break
    await fpage.evaluate(() => {
      const wb = document.querySelector<HTMLButtonElement>('.wave-btn')
      if (wb && !wb.disabled) wb.click()
    })
    await fpage.waitForTimeout(700)
  }
  const resultShown = await fpage.locator('#screen-result.active').count()
  console.log('result screen shown:', resultShown)
  if (resultShown) {
    console.log('result title:', await fpage.textContent('#screen-result h2'))
    console.log('result rows:', await fpage.locator('.result-rows div').count())
    await fpage.screenshot({ path: 'dist-test/smoke-result.png' })
    // retry button should restart the stage
    await fpage.evaluate(() => {
      document.querySelector<HTMLButtonElement>('.screen-footer .btn.primary')?.click()
    })
    await fpage.waitForTimeout(1200)
    console.log('restarted battle canvas:', await fpage.locator('#game-canvas').count())
  }
  const saved = await fpage.evaluate(() => {
    const raw = localStorage.getItem('aegis-td-save-v1')
    return raw ? JSON.parse(raw).coins : null
  })
  console.log('coins persisted:', saved)
  await finCtx.close()

  await page.goto(URL_BASE, { waitUntil: 'load' })
  await page.waitForTimeout(700)
  await page.locator('#screen-title .menu-list .btn').nth(1).click()
  await page.waitForTimeout(1500)
  console.log('endless canvas count:', await page.locator('#game-canvas').count())
  await page.screenshot({ path: 'dist-test/smoke-endless.png' })

  await page.goto(URL_BASE, { waitUntil: 'load' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'dist-test/smoke-title.png' })

  await browser.close()
  await stop()

  console.log('\n--- errors ---')
  if (errors.length === 0) console.log('none')
  else for (const e of errors) console.log(e)
  if (errors.some((e) => e.startsWith('pageerror'))) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

