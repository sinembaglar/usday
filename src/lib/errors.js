import { supabase } from './supabase'

// Errors in people's apps are reported once per kind per visit, so problems reach us before anyone has to
// tell us. Only the admins can read them; they are deleted after 30 days.
const sent = new Set()
const MAX_PER_VISIT = 10
const IGNORE = [/ResizeObserver loop/, /(chrome|moz|safari(-web)?)-extension:/, /^Script error\.?$/]

// The build's file name tells which version of the app was running.
const version = () => document.querySelector('script[type="module"][src*="/assets/"]')?.src.split('/').pop() ?? 'dev'

export function reportError(kind, error) {
  try {
    if (!navigator.onLine) return // a lost connection is not a bug in the app
    const message = String(error?.message ?? error ?? '').slice(0, 500) || 'Bilinmeyen hata'
    const stack = String(error?.stack ?? '').slice(0, 4000)
    if (IGNORE.some((re) => re.test(message) || re.test(stack))) return
    const key = `${kind}:${message}`
    if (sent.has(key) || sent.size >= MAX_PER_VISIT) return
    sent.add(key)
    supabase
      .from('client_errors')
      .insert({
        kind,
        message,
        stack: stack || null,
        url: window.location.pathname.slice(0, 300), // no query string: it can hold invitation codes
        user_agent: navigator.userAgent.slice(0, 300),
        version: version().slice(0, 60),
      })
      .then(
        () => {},
        () => {},
      )
  } catch {
    // reporting must never break the app
  }
}

export function watchErrors() {
  window.addEventListener('error', (e) => reportError('error', e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError('rejection', e.reason))
}
