import './styles.css'
import { App } from './app'
import { audio } from './audio/synth'
import { loadSave, saveNow } from './save/save'
import { setLang } from './util/i18n'

function boot(): void {
  const root = document.getElementById('app')
  if (!root) return
  root.removeAttribute('aria-busy')

  const save = loadSave()
  setLang(save.settings.lang)
  audio.sfxOn = save.settings.sfx
  audio.musicOn = save.settings.music

  const app = new App(root)

  // PWA install prompt (Chrome / Edge / Android)
  const anyWin = window as unknown as {
    __aegisInstallPrompt?: { prompt: () => Promise<void>; userChoice?: Promise<unknown> }
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    anyWin.__aegisInstallPrompt = e as unknown as { prompt: () => Promise<void> }
  })
  window.addEventListener('appinstalled', () => {
    anyWin.__aegisInstallPrompt = undefined
  })

  // keep playtime counting while a battle runs
  window.addEventListener('pagehide', () => saveNow(save))

  // expose a tiny handle for debugging in the console
  ;(window as unknown as { aegis?: App }).aegis = app
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
