import { REPEATS } from './recurrence'
import { dateText, isEn, t } from './i18n'

// Turkish dative: "Serhat Han’a", "Sinem’e", "Ayşe’ye".
export function dative(name) {
  const lower = name.toLocaleLowerCase('tr')
  const vowels = [...lower].filter((c) => 'aeıioöuü'.includes(c))
  const back = 'aıou'.includes(vowels.at(-1) ?? 'e')
  const endsWithVowel = 'aeıioöuü'.includes(lower.at(-1))
  return `${name}’${endsWithVowel ? 'y' : ''}${back ? 'a' : 'e'}`
}

// Turkish genitive: "Serhat Han’ın", "Sinem’in", "Ayşe’nin", "Burcu’nun".
export function genitive(name) {
  const lower = name.toLocaleLowerCase('tr')
  const last = [...lower].filter((c) => 'aeıioöuü'.includes(c)).at(-1) ?? 'e'
  const vowel = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' }[last]
  const endsWithVowel = 'aeıioöuü'.includes(lower.at(-1))
  return `${name}’${endsWithVowel ? 'n' : ''}${vowel}n`
}

// "Ece’nin" / "Ece’s": the word order is the same in both languages ("Ece’nin doğum günü", "Ece’s birthday").
export const possessive = (name) => (isEn ? `${name}’s` : genitive(name))

export const timeSpan = (e) =>(e.time ? (e.endTime ? `${e.time}–${e.endTime}` : e.time) : '')

export function repeatLabel(e) {
  if (!e.repeat || e.repeat === 'none') return ''
  const day = e.repeatUntil && dateText(e.repeatUntil, 'd MMMM yyyy', 'MMMM d, yyyy')
  const until = day ? ` · ${t(`${day}’e kadar`, `until ${day}`)}` : ''
  return `${REPEATS[e.repeat]}${until}`
}

// Apple Maps on iPhone, Google Maps everywhere else.
export function mapsUrl(place) {
  const q = encodeURIComponent(place)
  return /iPhone|iPad|Macintosh/.test(navigator.userAgent)
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`
}

export function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60_000)
  if (minutes < 1) return t('şimdi', 'now')
  if (minutes < 60) return t(`${minutes} dk`, `${minutes}m`)
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t(`${hours} sa`, `${hours}h`)
  return dateText(new Date(iso), 'd MMM', 'MMM d')
}
