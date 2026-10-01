type Attrs = Record<string, string | number | boolean | EventListener | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null | undefined | false)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    } else if (k === 'class') {
      el.className = String(v)
    } else if (k === 'html') {
      el.innerHTML = String(v)
    } else if (k === 'text') {
      el.textContent = String(v)
    } else if (v === true) {
      el.setAttribute(k, '')
    } else {
      el.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

export const clear = (el: HTMLElement): void => {
  while (el.firstChild) el.removeChild(el.firstChild)
}

let toastRoot: HTMLElement | null = null

export function toast(msg: string, variant: 'plain' | 'gold' | 'accent' = 'plain', ms = 1800): void {
  if (!toastRoot) {
    toastRoot = h('div', { id: 'toast-root' })
    document.body.appendChild(toastRoot)
  }
  const el = h('div', { class: `toast ${variant === 'plain' ? '' : variant}`, text: msg })
  toastRoot.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity .25s'
    setTimeout(() => el.remove(), 260)
  }, ms)
}

let modalBack: HTMLElement | null = null
let modalResolve: ((v: boolean) => void) | null = null

export function confirmDialog(title: string, message: string, okLabel: string, cancelLabel: string): Promise<boolean> {
  if (!modalBack) {
    modalBack = h('div', { class: 'modal-back' })
    document.body.appendChild(modalBack)
  }
  clear(modalBack)
  const back = modalBack
  const close = (v: boolean) => {
    back.classList.remove('show')
    modalResolve?.(v)
    modalResolve = null
  }
  const card = h('div', { class: 'modal' }, [
    h('h3', { text: title }),
    h('p', { text: message }),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn ghost', text: cancelLabel, onclick: () => close(false) }),
      h('button', { class: 'btn danger', text: okLabel, onclick: () => close(true) }),
    ]),
  ])
  back.appendChild(card)
  back.classList.add('show')
  return new Promise<boolean>((res) => {
    modalResolve = res
  })
}

/**
 * Small helper to render an icon into a fresh canvas element.
 * The draw callback receives a context already translated to the canvas
 * centre, so centred artwork (e.g. drawTowerIcon) lands in the middle.
 */
export function iconCanvas(size: number): { canvas: HTMLCanvasElement; draw: (fn: (c: CanvasRenderingContext2D) => void) => void } {
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const canvas = document.createElement('canvas')
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  const ctx = canvas.getContext('2d')
  return {
    canvas,
    draw: (fn) => {
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      ctx.save()
      ctx.translate(size / 2, size / 2)
      fn(ctx)
      ctx.restore()
    },
  }
}
