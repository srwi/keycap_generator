import { writable } from 'svelte/store'

export type Theme = 'dark' | 'light' | 'system'

export type ThemeConfig = {
  defaultTheme?: Theme
  storageKey?: string
}

const DEFAULT_STORAGE_KEY = 'vite-ui-theme'

export const theme = writable<Theme>('system')

function getSystemTheme(): Exclude<Theme, 'system'> {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
}

export function applyTheme(t: Theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')

  const effective = t === 'system' ? getSystemTheme() : t
  root.classList.add(effective)
}

export function setTheme(next: Theme, storageKey: string = DEFAULT_STORAGE_KEY) {
  try {
    localStorage.setItem(storageKey, next)
  } catch {
    // ignore
  }
  theme.set(next)
}

export function initTheme(config: ThemeConfig = {}) {
  const storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY
  const fallback = config.defaultTheme ?? 'system'

  let initial: Theme = fallback
  try {
    initial = (localStorage.getItem(storageKey) as Theme) || fallback
  } catch {
    // ignore
  }

  theme.set(initial)

  const unsubscribe = theme.subscribe(t => {
    if (typeof window === 'undefined') return
    applyTheme(t)
  })

  // Keep in sync with system theme when theme === "system"
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onChange = () => {
    let current: Theme = 'system'
    const unsubOnce = theme.subscribe(t => (current = t))
    unsubOnce()
    if (current === 'system') applyTheme('system')
  }

  if (mql?.addEventListener) mql.addEventListener('change', onChange)
  else mql?.addListener?.(onChange)

  return () => {
    unsubscribe()
    if (mql?.removeEventListener) mql.removeEventListener('change', onChange)
    else mql?.removeListener?.(onChange)
  }
}
