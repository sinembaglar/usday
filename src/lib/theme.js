const KEY = 'usday:theme' // 'system' | 'light' | 'dark'
const BACKGROUND = { light: '#F6F3EF', dark: '#1A1418' }

export function getTheme() {
  try {
    return localStorage.getItem(KEY) ?? 'system'
  } catch {
    return 'system'
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

// Whether the app is showing its dark theme right now.
export const isDark = () => {
  const theme = getTheme()
  return theme === 'system' ? systemDark() : theme === 'dark'
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  const effective = theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BACKGROUND[effective])
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // private mode: the choice lasts until the app closes
  }
  applyTheme(theme)
}

export function watchSystemTheme() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())
}
