import { REPEATS } from './recurrence'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

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

export const timeSpan = (e) =>(e.time ? (e.endTime ? `${e.time}–${e.endTime}` : e.time) : '')

export function repeatLabel(e) {
  if (!e.repeat || e.repeat === 'none') return ''
  const until = e.repeatUntil ? ` · ${format(parseISO(e.repeatUntil), 'd MMMM yyyy', { locale: tr })}’e kadar` : ''
  return `🔁 ${REPEATS[e.repeat]}${until}`
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
  if (minutes < 1) return 'şimdi'
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} sa`
  return format(new Date(iso), 'd MMM', { locale: tr })
}
