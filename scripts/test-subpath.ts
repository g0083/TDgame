/* Verify the built app works when served from a sub-path (GitHub Pages style). */
/* eslint-disable no-console */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const PREFIX = '/TDgame'
const PORT = 4199

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
    if (!p.startsWith(PREFIX)) {
      res.writeHead(404)
      res.end('outside scope')
      return
    }
    p = p.slice(PREFIX.length) || '/'
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
  })
  await new Promise<void>((r) => server.listen(PORT, r))
  return () =>
    new Promise<void>((r) => {
      server.close(() => r())
    })
}

const errors: string[] = []
const BASE = `http://localhost:${PORT}${PREFIX}/`

async function main(): Promise<void> {
  const stop = await serve()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`))

  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  console.log('title logo:', await page.textContent('#screen-title .logo'))

  const assetOk = await page.evaluate(() => {
    const s = [...document.querySelectorAll('script[src],link[href]')].map((e) =>
      e.getAttribute('src') ?? e.getAttribute('href'),
    )
    return s.filter((x) => x && !x.startsWith('http'))
  })
  console.log('local assets:', JSON.stringify(assetOk))

  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported'
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    return reg ? `ready scope=${reg.scope}` : 'none'
  })
  console.log('service worker:', sw)

  const man = await page.evaluate(async () => {
    const res = await fetch('./manifest.webmanifest')
    if (!res.ok) return `fetch ${res.status}`
    const j = await res.json()
    // resolve an icon url the way a browser would
    const iconUrl = new URL(j.icons[0].src, location.href).href
    const r2 = await fetch(iconUrl)
    return `${j.short_name} | icon ${r2.status} ${iconUrl}`
  })
  console.log('manifest:', man)

  // start a battle to make sure the JS bundle really runs
  await page.locator('#screen-title .menu-list .btn').first().click()
  await page.waitForTimeout(500)
  await page.locator('#screen-stages .stage-card').first().click()
  await page.waitForTimeout(1200)
  console.log('battle canvas:', await page.locator('#game-canvas').count())
  await page.screenshot({ path: 'dist-test/subpath-battle.png' })

  // offline under the sub-path
  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'load' }).catch((e) => errors.push(`offline reload: ${e.message}`))
  await page.waitForTimeout(1500)
  console.log('offline title logo:', await page.textContent('#screen-title .logo').catch(() => null))
  await ctx.setOffline(false)

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
