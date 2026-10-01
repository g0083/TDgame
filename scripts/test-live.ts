/* End-to-end check against the live GitHub Pages URL. */
/* eslint-disable no-console */
import { chromium } from 'playwright'

const URL_BASE = process.env.LIVE_URL ?? 'https://g0083.github.io/TDgame/'
const errors: string[] = []

async function main(): Promise<void> {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`))

  await page.goto(URL_BASE, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  console.log('title:', await page.title())
  console.log('logo:', await page.textContent('#screen-title .logo'))
  console.log('menu items:', await page.locator('#screen-title .menu-list .btn').count())

  // manifest + icons resolve from the sub-path
  const man = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel=manifest]')
    if (!link) return 'no manifest link'
    const res = await fetch(link.href)
    if (!res.ok) return `manifest ${res.status}`
    const j = await res.json()
    const icon = await fetch(new URL(j.icons[0].src, link.href).href)
    return `${j.short_name} | scope=${j.scope} | icon=${icon.status}`
  })
  console.log('manifest:', man)

  // service worker registers under the right scope
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported'
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    return reg ? `ready scope=${reg.scope}` : 'none'
  })
  console.log('service worker:', sw)

  // play a bit
  await page.locator('#screen-title .menu-list .btn').first().click()
  await page.waitForTimeout(600)
  console.log('stage cards:', await page.locator('#screen-stages .stage-card').count())
  await page.locator('#screen-stages .stage-card').first().click()
  await page.waitForTimeout(1500)
  const canvas = await page.locator('#game-canvas').boundingBox()
  console.log('battle canvas:', canvas)
  console.log('build buttons:', await page.locator('.tower-btn').count())
  console.log('abilities:', await page.locator('.ability-btn').count())

  // build a couple of towers and run a wave
  if (canvas) {
    await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>('.tower-btn')[0]?.click())
    await page.mouse.click(canvas.x + canvas.width * 0.45, canvas.y + canvas.height * 0.4)
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      document.querySelectorAll<HTMLButtonElement>('.tower-btn')[3]?.click()
    })
    await page.mouse.click(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.6)
    await page.waitForTimeout(300)
  }
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const wb = document.querySelector<HTMLButtonElement>('.wave-btn')
      if (wb && !wb.disabled) wb.click()
    })
    await page.waitForTimeout(2500)
  }
  console.log('wave:', await page.textContent('.wave-label'))
  console.log('lives:', await page.textContent('.stat.lives span:nth-child(2)'))
  await page.screenshot({ path: 'dist-test/live-battle.png' })

  // offline reload over HTTPS
  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'load' }).catch((e) => errors.push(`offline reload: ${e.message}`))
  await page.waitForTimeout(2500)
  console.log('offline logo:', await page.textContent('#screen-title .logo').catch(() => null))
  await ctx.setOffline(false)

  // installability
  const install = await page.evaluate(() => {
    const manifestOk = !!document.querySelector('link[rel=manifest]')
    return { manifestOk, sw: 'serviceWorker' in navigator }
  })
  console.log('installability signals:', JSON.stringify(install))

  await browser.close()
  console.log('\n--- errors ---')
  if (errors.length === 0) console.log('none')
  else for (const e of errors) console.log(e)
  if (errors.some((e) => e.startsWith('pageerror'))) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
