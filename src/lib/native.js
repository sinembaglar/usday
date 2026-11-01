import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

// Running inside the iPhone or Android app rather than a browser tab.
export const isNative = Capacitor.isNativePlatform()

// The public site. Inside the app the page's own address is not usday.app, so links people receive
// (invitations, password resets) and pages that leave the app (privacy, terms) use the site's address.
export const SITE = 'https://usday.app'
export const publicOrigin = () => (isNative ? SITE : window.location.origin)
export const siteUrl = (path) => (isNative ? `${SITE}${path}` : path)

// Share a text and a link through the phone's own share menu (or the browser's). Returns false when
// sharing is not possible here, so the caller can copy the text instead.
export async function shareText({ title, text, url }) {
  if (isNative) {
    try {
      await Share.share({ title, text, url, dialogTitle: title })
    } catch {
      // closed the share menu
    }
    return true
  }
  if (!navigator.share) return false
  await navigator.share({ title, text, url }).catch(() => {})
  return true
}

// Share an image (a share card). In the app it is written to a temporary file first.
export async function shareImage(blob, name) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
  try {
    await Share.share({ files: [uri] })
  } catch {
    // closed the share menu
  }
}

// Status bar text: light on the dark cover and in the dark theme, dark on light pages.
export function statusBarText(light) {
  if (!isNative) return
  StatusBar.setStyle({ style: light ? Style.Dark : Style.Light }).catch(() => {})
}

// The launch screen stays until the first real screen is drawn.
export function hideSplash() {
  if (isNative) SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {})
}
