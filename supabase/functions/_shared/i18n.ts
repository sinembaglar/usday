// Notifications, reminders and the calendar feed speak each person's language (profiles.lang) and follow
// their clock (profiles.time_zone). Texts are written in both languages where they are used:
// say(lang, 'Yarın', 'Tomorrow').
export type Lang = 'tr' | 'en'

export const asLang = (value: unknown): Lang => (value === 'en' ? 'en' : 'tr')

export const say = (lang: Lang, tr: string, en: string) => (lang === 'en' ? en : tr)

const DEFAULT_ZONE = 'Europe/Istanbul'

// A time zone the runtime knows, or Istanbul.
export function zoneOf(value: unknown) {
  if (typeof value !== 'string' || !value) return DEFAULT_ZONE
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return value
  } catch {
    return DEFAULT_ZONE
  }
}

// Turkish genitive, as in the app: "Sinem’in", "Ayşe’nin", "Serhat Han’ın".
export function genitive(name: string) {
  const lower = name.toLocaleLowerCase('tr')
  const last = [...lower].filter((c) => 'aeıioöuü'.includes(c)).at(-1) ?? 'e'
  const vowel = ({ a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' } as Record<string, string>)[last]
  const endsWithVowel = 'aeıioöuü'.includes(lower.at(-1) ?? '')
  return `${name}’${endsWithVowel ? 'n' : ''}${vowel}n`
}

// "Ece’nin" / "Ece’s"
export const possessive = (lang: Lang, name: string) => (lang === 'en' ? `${name}’s` : genitive(name))

export const num = (lang: Lang, n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR')

// "2nd", "100th" / "2.", "100."
export function ordinal(lang: Lang, n: number) {
  if (lang !== 'en') return `${num(lang, n)}.`
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${num(lang, n)}${suffix}`
}

const dayFormats = {
  tr: new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' }),
}

// "12 Kasım Çarşamba" / "Wednesday, November 12"
export const formatDay = (lang: Lang, date: string) => dayFormats[lang].format(new Date(`${date}T00:00:00Z`))

// Today, tomorrow and the minute of the day on a person's clock.
export function clockIn(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zoneOf(timeZone),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return { today, tomorrow: tomorrow.toISOString().slice(0, 10), minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export type Clock = ReturnType<typeof clockIn>
