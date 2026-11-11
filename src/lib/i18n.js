// The app speaks Turkish or English. Every text is written in both, side by side, where it is used:
// t('Kaydet', 'Save'). The language is picked once at start (a choice made in settings, or the phone's
// language) and changing it reloads the app.
import { format, parseISO } from 'date-fns'
import { enUS, tr as trLocale } from 'date-fns/locale'

const KEY = 'usday:lang'

function saved() {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'tr' || value === 'en' ? value : null
  } catch {
    return null
  }
}

// Turkish when the phone is set to Turkish, English otherwise.
export const phoneLanguage = () =>
  [...(navigator.languages ?? []), navigator.language].some((l) => /^tr\b/i.test(l ?? '')) ? 'tr' : 'en'

export const lang = saved() ?? phoneLanguage()
export const isEn = lang === 'en'
export const locale = isEn ? 'en-US' : 'tr-TR'

// 'auto' follows the phone; the app reloads so every screen is drawn again in the new language.
export const langChoice = () => saved() ?? 'auto'
export function setLangChoice(choice) {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // private mode: the phone's language stays
  }
  window.location.reload()
}

document.documentElement.lang = lang
if (isEn) document.title = 'UsDay · A shared calendar for your people'

export const t = (trText, enText) => (isEn ? enText : trText)

// The phone's time zone, for reminders and the calendar feed.
export const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'
  } catch {
    return 'Europe/Istanbul'
  }
}

// Dates in the app's language. Takes a Date or a 'yyyy-MM-dd' day.
export const dateText = (date, trPattern, enPattern) =>
  format(typeof date === 'string' ? parseISO(date) : date, isEn ? enPattern : trPattern, {
    locale: isEn ? enUS : trLocale,
  })

export const num = (n) => Number(n).toLocaleString(locale)

// "1st", "2nd", "23rd", "100th"; Turkish writes "1.", "100.".
export function ordinal(n) {
  if (!isEn) return `${num(n)}.`
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${num(n)}${suffix}`
}

// "1 day", "3 days" in English; Turkish never adds a plural after a number ("3 gün").
export const count = (n, trWord, enOne, enMany = `${enOne}s`) =>
  isEn ? `${num(n)} ${n === 1 ? enOne : enMany}` : `${num(n)} ${trWord}`

// "Ece", "Ece ve Can", "Ece, Can ve Ali" / "Ece and Can".
export const listNames = (names) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('ve', 'and')} ${names.at(-1)}` : (names[0] ?? '')

export const upper = (text) => text.toLocaleUpperCase(isEn ? 'en' : 'tr')

// The weekday letters over the month grid, Monday first.
export const weekdayShort = () =>
  Array.from({ length: 7 }, (_, i) => dateText(new Date(2024, 0, 1 + i), 'EEEEEE', 'EEEEEE'))
