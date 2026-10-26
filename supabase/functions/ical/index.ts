// Read-only calendar feed for Apple / Google Calendar: /cal/<token>.ics on usday.app.
// Shows what the token owner may see: a partner's hidden surprise appears only as its teaser.
import { admin, hiddenFrom, istanbulToday, peopleIn, type EventRow, type Person } from '../_shared/push.ts'
import { addDaysKey, milestones } from '../_shared/recurrence.ts'

const UTC_OFFSET_HOURS = 3 // Europe/Istanbul, no daylight saving since 2016
const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' } as const

const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const compactDate = (date: string) => date.replaceAll('-', '')

function utcStamp(date: string, time: string) {
  const d = new Date(`${date}T${time.slice(0, 5)}:00Z`)
  d.setUTCHours(d.getUTCHours() - UTC_OFFSET_HOURS)
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
}

function plusHour(time: string) {
  const h = (Number(time.slice(0, 2)) + 1) % 24
  return `${String(h).padStart(2, '0')}${time.slice(2, 5)}`
}

// Lines longer than 75 octets must be folded (RFC 5545).
function fold(line: string) {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (encoder.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

function timing(e: EventRow) {
  const start = e.event_time?.slice(0, 5)
  if (!start) {
    return {
      lines: [`DTSTART;VALUE=DATE:${compactDate(e.event_date)}`, `DTEND;VALUE=DATE:${compactDate(addDaysKey(e.event_date, 1))}`],
      at: (date: string) => `;VALUE=DATE:${compactDate(date)}`,
      until: (date: string) => compactDate(date),
    }
  }
  const end = e.end_time?.slice(0, 5) || plusHour(start)
  const endDate = end > start ? e.event_date : addDaysKey(e.event_date, 1) // past midnight
  return {
    lines: [`DTSTART:${utcStamp(e.event_date, start)}`, `DTEND:${utcStamp(endDate, end)}`],
    at: (date: string) => `:${utcStamp(date, start)}`,
    until: (date: string) => utcStamp(date, '23:59').replace(/00Z$/, '59Z'),
  }
}

function vevent(e: EventRow & { created_at: string }, viewer: string, people: Person[], today: string, suffix = '') {
  if (e.status === 'declined') return []
  const hidden = hiddenFrom(e, viewer, today)
  const author = people.find((p) => p.id === e.created_by)?.name ?? ''
  const tentative = e.status === 'proposed'
  const summary = (tentative ? '❓ ' : '') + (hidden ? '🎁 Sürpriz!' : e.title) + suffix
  const description = hidden
    ? `${author} bir sürpriz hazırlıyor: “${e.teaser ?? ''}”`
    : [e.note, author && `${author} ekledi`].filter(Boolean).join('\n')
  const t = timing(e)

  const repeat =
    e.repeat !== 'none'
      ? [
          `RRULE:FREQ=${FREQ[e.repeat]}${e.repeat_until ? `;UNTIL=${t.until(e.repeat_until)}` : ''}`,
          ...e.skip_dates.map((d) => `EXDATE${t.at(d)}`),
        ]
      : []

  return [
    'BEGIN:VEVENT',
    `UID:${e.id}@usday.app`,
    `DTSTAMP:${stamp(e.created_at)}`,
    ...t.lines,
    ...repeat,
    `SUMMARY:${escape(summary)}`,
    tentative && 'STATUS:TENTATIVE',
    description && `DESCRIPTION:${escape(description)}`,
    !hidden && e.location && `LOCATION:${escape(e.location)}`,
    `URL:https://usday.app/?event=${e.id}`,
    'END:VEVENT',
  ].filter(Boolean) as string[]
}

// Anniversaries and day-count milestones for the next few years, as all-day events.
function milestoneEvents(couple: { id: string; together_since: string; relation: string }, today: string, suffix: string) {
  return milestones(couple.together_since, addDaysKey(today, -365), addDaysKey(today, 5 * 365), couple.relation).flatMap((m) => [
    'BEGIN:VEVENT',
    `UID:${m.kind}-${m.count}-${couple.id}@usday.app`,
    `DTSTAMP:${compactDate(today)}T000000Z`,
    `DTSTART;VALUE=DATE:${compactDate(m.date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDaysKey(m.date, 1))}`,
    `SUMMARY:${escape(m.title + suffix)}`,
    'END:VEVENT',
  ])
}

Deno.serve(async (req) => {
  const token = (new URL(req.url).searchParams.get('token') ?? '').replace(/\.ics$/, '')
  if (!/^[0-9a-f-]{36}$/.test(token)) return new Response('not found', { status: 404 })

  const { data: owner } = await admin.from('calendar_tokens').select('user_id').eq('token', token).maybeSingle()
  if (!owner) return new Response('not found', { status: 404 })

  // Every connection of the owner goes into one calendar.
  const { data: memberships } = await admin.from('couple_members').select('couple_id').eq('user_id', owner.user_id)
  const coupleIds = (memberships ?? []).map((m) => m.couple_id)
  const [people, { data: coupleEvents }, { data: couples }, { data: invitedTo }, { data: made }] = await Promise.all([
    peopleIn(coupleIds),
    admin.from('events').select('*').in('couple_id', coupleIds),
    admin.from('couples').select('id, together_since, relation').in('id', coupleIds),
    // Group plans: the ones I made, and the ones I have not turned down.
    admin.from('event_participants').select('event_id').eq('user_id', owner.user_id).neq('status', 'declined'),
    admin.from('events').select('*').is('couple_id', null).eq('created_by', owner.user_id),
  ])
  const { data: joined } = invitedTo?.length
    ? await admin.from('events').select('*').in('id', invitedTo.map((p) => p.event_id))
    : { data: [] }
  const events = [...(coupleEvents ?? []), ...(made ?? []), ...(joined ?? [])]
  // With several connections, say who a plan is with: "Brunch · Ayşe".
  const many = coupleIds.length > 1
  const withWhom = (coupleId: string | null) => {
    if (!coupleId) return ' · 👥'
    const other = people.find((p) => p.couple_id === coupleId && p.id !== owner.user_id)
    return many && other ? ` · ${other.name}` : ''
  }

  const today = istanbulToday()
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
    ...(events ?? []).flatMap((e) => vevent(e, owner.user_id, people, today, withWhom(e.couple_id))),
    ...(couples ?? []).filter((c) => c.together_since).flatMap((c) => milestoneEvents(c, today, withWhom(c.id))),
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
