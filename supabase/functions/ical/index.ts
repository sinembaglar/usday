// Read-only calendar feed for Apple / Google Calendar: /cal/<token>.ics on usday.app.
// Shows what the token owner may see: a partner's hidden surprise appears only as its teaser.
import { admin, type EventRow, type Person } from '../_shared/push.ts'

const UTC_OFFSET_HOURS = 3 // Europe/Istanbul, no daylight saving since 2016

const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const compactDate = (date: string) => date.replaceAll('-', '')

function utcStamp(date: string, time: string, plusHours = 0) {
  const d = new Date(`${date}T${time.slice(0, 5)}:00Z`)
  d.setUTCHours(d.getUTCHours() - UTC_OFFSET_HOURS + plusHours)
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
}

function nextDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Lines longer than 75 octets must be folded (RFC 5545).
function fold(line: string) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function vevent(e: EventRow & { created_at: string }, viewer: string, people: Person[], today: string) {
  const hidden = e.surprise && e.created_by !== viewer && (e.reveal_on ?? e.event_date) > today
  const author = people.find((p) => p.id === e.created_by)?.name ?? ''
  const summary = hidden ? '🎁 Sürpriz!' : e.title
  const description = hidden
    ? `${author} bir sürpriz hazırlıyor: “${e.teaser ?? ''}”`
    : [e.note, author && `${author} ekledi`].filter(Boolean).join('\n')

  const when = e.event_time
    ? [`DTSTART:${utcStamp(e.event_date, e.event_time)}`, `DTEND:${utcStamp(e.event_date, e.event_time, 1)}`]
    : [`DTSTART;VALUE=DATE:${compactDate(e.event_date)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(e.event_date))}`]

  return [
    'BEGIN:VEVENT',
    `UID:${e.id}@usday.app`,
    `DTSTAMP:${new Date(e.created_at).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    ...when,
    `SUMMARY:${escape(summary)}`,
    description && `DESCRIPTION:${escape(description)}`,
    `URL:https://usday.app/?event=${e.id}`,
    'END:VEVENT',
  ].filter(Boolean) as string[]
}

Deno.serve(async (req) => {
  const token = (new URL(req.url).searchParams.get('token') ?? '').replace(/\.ics$/, '')
  if (!/^[0-9a-f-]{36}$/.test(token)) return new Response('not found', { status: 404 })

  const { data: owner } = await admin.from('calendar_tokens').select('user_id').eq('token', token).maybeSingle()
  if (!owner) return new Response('not found', { status: 404 })

  const { data: me } = await admin.from('profiles').select('couple_id').eq('id', owner.user_id).single()
  const [{ data: people }, { data: events }] = await Promise.all([
    admin.from('profiles').select('id, name, couple_id').eq('couple_id', me!.couple_id),
    admin.from('events').select('*').eq('couple_id', me!.couple_id),
  ])

  const today = new Date(Date.now() + UTC_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UsDay//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:UsDay 💜',
    'X-WR-TIMEZONE:Europe/Istanbul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...(events ?? []).flatMap((e) => vevent(e, owner.user_id, people as Person[], today)),
    'END:VCALENDAR',
  ]

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="usday.ics"',
      'Cache-Control': 'no-store',
    },
  })
})
