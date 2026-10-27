// An app added to the home screen stays in memory for days and does not reload when it comes back
// to the front, so it would keep running an old version. Whenever it comes back, compare the script
// it runs with the one the site serves now, and reload if a new version is out.

const LINK_KEY = 'usday:link' // a tapped notification's link, kept across that reload

const running = document.querySelector('script[type="module"][src*="/assets/"]')?.src ?? null

async function newVersionOut() {
  const html = await (await fetch('/', { cache: 'no-store' })).text()
  const served = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
  return Boolean(served && running && !running.endsWith(served))
}

export function watchForUpdates() {
  if (!running) return // development server
  const check = () => {
    if (document.visibilityState !== 'visible') return
    newVersionOut()
      .then((stale) => stale && window.location.reload())
      .catch(() => {}) // offline: try again next time
  }
  document.addEventListener('visibilitychange', check)
  window.addEventListener('pageshow', check)
  // iOS does not always say the app came back (opened from a notification, or after a long sleep),
  // so look now and then while it is on screen too.
  setInterval(check, 5 * 60 * 1000)
}

// A notification tapped while the app was in the background: remember it until it has been opened.
export function rememberLink(url) {
  try {
    sessionStorage.setItem(LINK_KEY, url)
  } catch {
    // private mode: the link still opens unless the app reloads first
  }
}

export function forgetLink() {
  try {
    sessionStorage.removeItem(LINK_KEY)
  } catch {
    // nothing to forget
  }
}

// The link the app was opened with: from the address, or one left over from an update reload.
// Read once per page load (the saved one is used up).
let opened = null
export function startLink() {
  if (opened !== null) return opened
  opened = window.location.search
  try {
    const saved = sessionStorage.getItem(LINK_KEY)
    sessionStorage.removeItem(LINK_KEY)
    if (!opened && saved) opened = new URL(saved, window.location.origin).search
  } catch {
    // no saved link
  }
  return opened
}
