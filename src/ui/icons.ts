/**
 * Inline SVG icon set.
 *
 * Emoji are intentionally NOT used in the UI: they render differently on every
 * platform, ignore theme colours and clash with the canvas art. Every glyph here
 * is a hand-tuned 24x24 vector drawn with `currentColor`, so icons inherit the
 * surrounding text colour and stay crisp at any size.
 */

/** Icon body markup keyed by name. Coordinates live in a 24x24 box. */
const BODIES: Record<string, string> = {
  // ── currency / status ────────────────────────────────────
  coin:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.2v9.6M14.6 9.4c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.8-2.7 2s1.1 1.8 2.7 2c1.7.2 2.8 1 2.8 2.2s-1.2 2.2-2.9 2.2c-1.2 0-2.2-.5-2.8-1.4"/>',
  life:
    '<path d="M12 20.3S3.8 15 3.8 9.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.2 2.2c0 5.6-8.2 10.9-8.2 10.9Z"/>',
  lock:
    '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2"/><path d="M8 10.5V7.4a4 4 0 0 1 8 0v3.1"/><circle cx="12" cy="15.8" r="1.2"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronRight: '<path d="M9.5 5 16.5 12l-7 7"/>',
  arrowLeft: '<path d="M19 12H5M5 12l6-6M5 12l6 6"/>',
  info:
    '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5"/><circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none"/>',
  warn:
    '<path d="M12 3.6 21.2 20H2.8L12 3.6Z"/><path d="M12 9.6v4.6"/><circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none"/>',
  star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.6Z"/>',
  starOff:
    '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.6Z" opacity=".3"/>',
  // ── meta screens ──────────────────────────────────────────
  play: '<path d="M7 4.8 19 12 7 19.2V4.8Z"/>',
  pause:
    '<rect x="7" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2"/>',
  infinite:
    '<path d="M8.6 8.4a3.6 3.6 0 1 0 0 7.2c2 0 3.1-1.6 5.4-3.6 2.3 2 3.4 3.6 5.4 3.6a3.6 3.6 0 1 0 0-7.2c-2 0-3.1 1.6-5.4 3.6-2.3-2-3.4-3.6-5.4-3.6Z"/>',
  trophy:
    '<path d="M8 4h8v5.2a4 4 0 0 1-8 0V4Z"/><path d="M8 5.6H5.4v1.6a3 3 0 0 0 3 3M16 5.6h2.6v1.6a3 3 0 0 1-3 3"/><path d="M12 13.2v3.2M8.6 20.4h6.8l-.9-4H9.5l-.9 4Z"/>',
  medal:
    '<circle cx="12" cy="14.6" r="5.2"/><path d="m8.4 9.8-2.6-6h5l1.4 2.8M15.6 9.8l2.6-6h-5l-1.4 2.8"/><path d="m12 12.2 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1Z"/>',
  calendar:
    '<rect x="3.6" y="5" width="16.8" height="16" rx="2.2"/><path d="M3.6 10h16.8M8 3v4M16 3v4"/>',
  calendarCheck:
    '<rect x="3.6" y="5" width="16.8" height="16" rx="2.2"/><path d="M3.6 10h16.8M8 3v4M16 3v4"/><path d="m8.8 15.2 2.2 2.2 4.2-4.4"/>',
  hourglass:
    '<path d="M6.4 3h11.2M6.4 21h11.2"/><path d="M7.6 3v3.4c0 2 4.4 4 4.4 5.6s-4.4 3.6-4.4 5.6V21M16.4 3v3.4c0 2-4.4 4-4.4 5.6s4.4 3.6 4.4 5.6V21"/>',
  flask:
    '<path d="M9.6 3v6L5.4 18a2.4 2.4 0 0 0 2.1 3.6h9a2.4 2.4 0 0 0 2.1-3.6l-4.2-9V3"/><path d="M8.4 3h7.2"/><path d="M7.6 14.6h8.8"/>',
  gear:
    '<circle cx="12" cy="12" r="3.1"/><path d="M19.1 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.5 1.5 0 0 0-1.4.9Z"/>',
  book:
    '<path d="M4 5.4A2.4 2.4 0 0 1 6.4 3H20v16.2H6.4A2.4 2.4 0 0 0 4 21.6V5.4Z"/><path d="M4 19.2a2.4 2.4 0 0 1 2.4-2.4H20"/><path d="M8.2 7.2h7.6M8.2 10.8h5"/>',
  // ── combat / traits ───────────────────────────────────────
  target:
    '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  skull:
    '<path d="M12 2.9a7.9 7.9 0 0 0-4.4 14.3v1.9c0 .8.6 1.4 1.4 1.4h6c.8 0 1.4-.6 1.4-1.4v-1.9A7.9 7.9 0 0 0 12 2.9Z"/><circle cx="9.4" cy="11" r="1.5"/><circle cx="14.6" cy="11" r="1.5"/><path d="M10.4 20.5v-2.6h3.2v2.6"/>',
  skullBones:
    '<circle cx="12" cy="10" r="5.6"/><circle cx="10" cy="9.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="14" cy="9.6" r="1.1" fill="currentColor" stroke="none"/><path d="M10.6 14.8h2.8"/><path d="m5.4 17.4 2.4 2.4M18.6 17.4l-2.4 2.4M18.6 17.4l-2.4 2.4M5.4 17.4l2.4 2.4"/>',
  volcano:
    '<path d="M9.4 3.2h5.2l-.9 2.6h-3.4l-.9-2.6Z"/><path d="M9.6 5.8 3.1 18.6a2.1 2.1 0 0 0 1.8 3.2h14.2a2.1 2.1 0 0 0 1.8-3.2L14.4 5.8"/><path d="M9.8 21.8c0-1.7 1.6-2.2 1.6-4s-1.6-2.4-1.6-2.4"/>',
  flame:
    '<path d="M12 2.6s5.6 4.9 5.6 9.9a5.6 5.6 0 0 1-11.2 0c0-1.8.7-3.3 1.7-4.8.5 1.4 1.4 2.2 2.4 2.2 1.4 0 1.6-1.6 1.5-7.3Z"/><path d="M12 21.8a2.8 2.8 0 0 0 2.8-2.9c0-2-2.8-4.4-2.8-4.4s-2.8 2.4-2.8 4.4a2.8 2.8 0 0 0 2.8 2.9Z"/>',
  snowflake:
    '<path d="M12 2.6v18.8M4.1 7.2l15.8 9.6M19.9 7.2 4.1 16.8"/><path d="m9.4 4.5 2.6 2 2.6-2M9.4 19.5l2.6-2 2.6 2M5.9 10.7l3.3-.4-1.4-2.9M18.1 13.3l-3.3.4 1.4 2.9M6.4 14.5l3.3-1.7-1.4-2.9M17.6 9.5l-3.3 1.7 1.4 2.9"/>',
  bolt: '<path d="M13.4 2 5 13.4h5.8L10.6 22 19 10.6h-5.8L13.4 2Z"/>',
  bomb:
    '<circle cx="10.8" cy="14.4" r="6.6"/><path d="m15.6 9.6 3-3"/><path d="M19.4 3.4a2.2 2.2 0 1 1-2.2 2.2 2.2 2.2 0 0 1 2.2-2.2Z"/><path d="m20.6 2.2 1 1M22.6 4.2h-1.6M21.6 2v1.6"/>',
  meteor:
    '<circle cx="7.6" cy="7.6" r="4.8"/><path d="m11.2 11.2 9 9"/><path d="m12.4 8.8 2.8 2.8M10 6.4 12.8 4M15.2 3.2 18 6"/>',
  claw:
    '<path d="M6.6 3.4c1.6 3.2 2.4 6.6 2.4 10.2s-.8 5.4-2.4 7.2"/><path d="M12 3.4c1.2 3.2 1.8 6.6 1.8 10.2s-.6 5.4-1.8 7.2"/><path d="M17.4 3.4c-1.6 3.2-2.4 6.6-2.4 10.2s.8 5.4 2.4 7.2"/><path d="M4.8 13.8c1.6 1 3.2 1.4 4.8 1.4 3.2 0 5.6-1.4 7.4-3"/>',
  trident:
    '<path d="M12 21.4V3.6M12 3.6c0 5.4-3.2 7.6-6.6 7.6M12 3.6c0 5.4 3.2 7.6 6.6 7.6"/><path d="M5.4 11.2v3.4a6.6 6.6 0 0 0 13.2 0v-3.4"/><path d="m9.6 2.4 2.4 2.8 2.4-2.8"/>',
  flag: '<path d="M5.6 21.4V3.2"/><path d="M5.6 4.4h13.2l-2.8 4.4 2.8 4.4H5.6"/>',
  shield:
    '<path d="M12 2.8 4.6 5.6v6.2c0 4.7 3.2 8.7 7.4 9.7 4.2-1 7.4-5 7.4-9.7V5.6L12 2.8Z"/>',
  shieldCheck:
    '<path d="M12 2.8 4.6 5.6v6.2c0 4.7 3.2 8.7 7.4 9.7 4.2-1 7.4-5 7.4-9.7V5.6L12 2.8Z"/><path d="m9.2 11.8 2 2 3.6-3.8"/>',
  shieldDot:
    '<path d="M12 2.8 4.6 5.6v6.2c0 4.7 3.2 8.7 7.4 9.7 4.2-1 7.4-5 7.4-9.7V5.6L12 2.8Z"/><circle cx="12" cy="11.2" r="2.4"/>',
  gem:
    '<path d="M6.4 3h11.2l3.4 5.6L12 21.4 2.9 8.6 6.4 3Z"/><path d="M2.9 8.6h18.2M8.8 8.6 10 3M15.2 8.6 14 3M12 8.6 7.6 3M12 8.6 16.4 3"/>',
  diamond:
    '<path d="M12 2.6 21.4 12 12 21.4 2.6 12 12 2.6Z"/><path d="M2.6 12h18.8M12 2.6 8.6 12l3.4 9.4L15.4 12 12 2.6Z"/>',
  crown: '<path d="m3.4 7.6 3.8 3.6L12 4.2l4.8 7 3.8-3.6-1.6 12.4H5L3.4 7.6Z"/><path d="M5.6 21h12.8"/>',
  city:
    '<path d="M3.4 20.6h17.2"/><path d="M5.6 20.6V9.4h5.2v11.2M13.6 20.6V5.4h4.8v15.2"/><path d="M7.6 12.6h1M7.6 15.8h1M15.6 9.4h1M15.6 12.6h1M15.6 15.8h1"/><path d="M10.8 20.6v-4.2h2.8v4.2"/>',
  swords:
    '<path d="M14.6 3.4h6v6l-9.6 9.6-3-3L17.6 6.4h-3"/><path d="M3.4 3.4h6v6l9.6 9.6"/><path d="M9.4 9.4 6.4 6.4M4 17.6l2.4 2.4M20 17.6l-2.4 2.4"/>',
  wrench:
    '<path d="M14.8 6.6a4.6 4.6 0 0 0 5.9 5.9l-8 8a2.4 2.4 0 0 1-3.4-3.4l8-8a4.6 4.6 0 0 0-2.5-2.5Z"/><path d="m9.4 14.6-4.2 4.2"/>',
  bank:
    '<path d="M3.4 9.6 12 4.2l8.6 5.4"/><path d="M5.6 10.4v8.2M9.8 10.4v8.2M14.2 10.4v8.2M18.4 10.4v8.2"/><path d="M3 20.6h18"/>',
  crane:
    '<path d="M3.4 20.6h17.2"/><path d="M6.6 20.6V4.4h11.8"/><path d="M6.6 4.4 3.8 7.6M18.4 4.4l-2.8 3.2"/><path d="M6.6 8.4h5.6"/>',
  pickaxe:
    '<path d="m3.4 20.6 9.2-9.2"/><path d="M11.6 4.4a7.6 7.6 0 0 1 8.6 8.6 8 8 0 0 1-3.6 2.6 8 8 0 0 0-2.6 3.6 7.6 7.6 0 0 1-8.6-8.6c1.6 1.2 3 1.8 4.2 1.8 1 0 1.6-.8 2-2.4Z"/>',
  megaphone:
    '<path d="M3.4 11.4v1.2a2 2 0 0 0 2 2h1l9.4 4.4V5l-9.4 4.4h-1a2 2 0 0 0-2 2Z"/><path d="M19 9.6a3.6 3.6 0 0 1 0 4.8"/>',
  gift:
    '<rect x="3.4" y="9.4" width="17.2" height="11.2" rx="1.8"/><path d="M2.4 9.4h19.2v3.8H2.4zM12 9.4v11.2"/><path d="M12 9.4S10.6 4.4 8 4.4a2.4 2.4 0 0 0 0 5M12 9.4s1.4-5 4-5a2.4 2.4 0 0 1 0 5"/>',
  recycle:
    '<path d="M3.4 12a8.6 8.6 0 0 1 15.1-5.6"/><path d="M18.4 2.6v3.8h-3.8"/><path d="M20.6 12a8.6 8.6 0 0 1-15.1 5.6"/><path d="M5.6 21.4v-3.8h3.8"/>',
  dna:
    '<path d="M6.6 2.6c0 5.4 10.8 6.4 10.8 12.2S6.6 19.4 6.6 21.4"/><path d="M17.4 2.6c0 5.4-10.8 6.4-10.8 12.2s10.8 6.6 10.8 8.6"/><path d="M8.4 6.6h7.2M6.6 10.4h10.8M6.6 15.4h10.8M8.4 18.8h7.2"/>',
  link:
    '<path d="M9.6 13.4a4.6 4.6 0 0 0 7 .6l2.6-2.6a4.6 4.6 0 0 0-6.5-6.5l-1.5 1.5"/><path d="M14.4 10.6a4.6 4.6 0 0 0-7-.6l-2.6 2.6a4.6 4.6 0 0 0 6.5 6.5l1.5-1.5"/>',
  timer:
    '<circle cx="12" cy="13.6" r="7.6"/><path d="M12 9.4v4.2l2.6 1.6M9.6 2.6h4.8"/>',
  boltNut:
    '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8"/><circle cx="12" cy="12" r="2.6"/>',
  drop: '<path d="M12 2.8s6.4 6.8 6.4 11a6.4 6.4 0 0 1-12.8 0c0-4.2 6.4-11 6.4-11Z"/>',
  trendDown: '<path d="m3.4 7 5.8 5.8 4-4 7.4 7.4"/><path d="M15.4 16.2h5.2V11"/>',
  microscope:
    '<path d="M7.4 21h11.2"/><path d="M9.4 21a6 6 0 0 0 6-6"/><path d="M13.6 3.4 8.8 8.2l3 3 4.8-4.8z"/><path d="m9.6 7.4-4.4 4.4a5 5 0 0 0 7 7l1.6-1.6"/>',
  telescope:
    '<path d="m3.4 13 12-5.4 2.4 6-12 5.4z"/><path d="m16.6 6.6 4.2-2M9.4 20.6l-2.4-1.4M16.6 14.4l1.6 2.2M7.4 21.6h11"/>',
  syringe:
    '<path d="m14.6 3.4 6 6"/><path d="m17.4 6.6-8 8-3.4 6 6-3.4 8-8"/><path d="m11 5 3-3 6 6-3 3M12.6 10.8l-3.4 3.4"/>',
  eye: '<path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M9.4 6.8A9.4 9.4 0 0 1 12 6.4c6 0 9.4 5.6 9.4 5.6a17 17 0 0 1-3 3.6M6.6 8A17 17 0 0 0 2.6 12S6 17.6 12 17.6a9 9 0 0 0 3.4-.6"/><path d="M4 4l16 16"/>',
  sparkle:
    '<path d="m12 3 2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2z"/><path d="m18.6 15.4.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  burst:
    '<path d="m12 2.4 2 5.8 5.8-2-2 5.8 5.8 2-5.8 2 2 5.8-5.8-2-2 5.8-2-5.8-5.8 2 2-5.8-5.8-2 5.8-2-2-5.8 5.8 2z"/>',
  hammer:
    '<path d="M13.6 4 20 10.4l-2.6 2.6-6.4-6.4L13.6 4Z"/><path d="m11.6 6.4-8.2 8.2 3 3 8.2-8.2"/>',
  spira:
    '<path d="M12 12.4a2 2 0 1 0 2-2 4.4 4.4 0 0 0-4.4 4.4A7 7 0 0 0 16.6 22"/><path d="M12 12.4 6.4 6.8"/><path d="m4.4 4.8 2 2 1.4-1.4"/>',
}

const ICON_NAMES = new Set<string>(Object.keys(BODIES))

export function isIconName(v: string): v is string {
  return ICON_NAMES.has(v)
}

function wrapIcon(name: string): string {
  const body = BODIES[name]
  if (!body) throw new Error(`unknown icon: ${name}`)
  return `<svg class="ico-svg" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

/** Raw markup of an icon, for `innerHTML` based rendering. */
export function iconMarkup(name: string): string {
  return wrapIcon(name)
}

/**
 * Build an inline `<svg>` for `name`. It inherits the surrounding font-size and
 * `currentColor`, so it can be dropped straight into any element.
 */
export function icon(name: string, size?: number): SVGElement {
  const tpl = document.createElement('div')
  tpl.innerHTML = wrapIcon(name)
  const svg = tpl.firstElementChild as SVGElement
  if (size !== undefined) {
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
  }
  return svg
}

/** Inline icon followed by text, e.g. a gold pill: `coinText('120', 'gold')`. */
export function iconText(name: string, text: string, cls = ''): HTMLElement {
  const el = document.createElement('span')
  if (cls) el.className = cls
  el.appendChild(icon(name))
  el.appendChild(document.createTextNode(text))
  return el
}