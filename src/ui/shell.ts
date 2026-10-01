import { h } from './dom'

export type ScreenId =
  | 'title'
  | 'stages'
  | 'battle'
  | 'result'
  | 'lab'
  | 'codex'
  | 'settings'
  | 'daily'
  | 'achievements'

export interface Screen {
  id: ScreenId
  el: HTMLElement
  header?: HTMLElement
  body: HTMLElement
  footer?: HTMLElement
}

export function createShell(root: HTMLElement, ids: ScreenId[]): Map<ScreenId, Screen> {
  const map = new Map<ScreenId, Screen>()
  for (const id of ids) {
    const body = h('div', { class: 'screen-body' })
    const el = h('div', { class: 'screen', id: `screen-${id}` }, [body])
    root.appendChild(el)
    map.set(id, { id, el, body })
  }
  return map
}

export function setScreen(screens: Map<ScreenId, Screen>, id: ScreenId): Screen {
  for (const [key, s] of screens) s.el.classList.toggle('active', key === id)
  const s = screens.get(id)!
  s.body.scrollTop = 0
  return s
}

export function header(title: string, onBack?: () => void, backLabel = '←'): HTMLElement {
  const kids: HTMLElement[] = []
  if (onBack) {
    kids.push(h('button', { class: 'btn icon-btn ghost', text: backLabel, onclick: onBack, 'aria-label': 'back' }))
  }
  kids.push(h('div', { class: 'screen-title', text: title }))
  return h('div', { class: 'screen-header' }, kids)
}
