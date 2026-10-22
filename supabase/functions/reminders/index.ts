// Runs every 10 minutes (pg_cron). Sends what is due right now, each kind once per event and person.
import {
  admin,
  eventUrl,
  formatWhen,
  sendToUsers,
  shortTime,
  type EventRow,
  type Payload,
  type Person,
} from '../_shared/push.ts'

const MORNING = 9 * 60 // day-before, same-day and reveal reminders go out from 09:00
const HOUR_BEFORE = 60

function istanbulNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return { today, tomorrow: tomorrow.toISOString().slice(0, 10), minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

type Job = { event: EventRow; userId: string; kind: string; payload: Payload }

function due(event: EventRow, person: Person, people: Person[], now: ReturnType<typeof istanbulNow>): Job[] {
  const hidden = event.surprise && person.id !== event.created_by && (event.reveal_on ?? event.event_date) > now.today
  const time = shortTime(event.event_time)
  const job = (kind: string, title: string, body: string) => ({
    event,
    userId: person.id,
    kind,
    payload: { title, body, url: eventUrl(event.id), tag: `${event.id}-${kind}` },
  })
  const jobs: Job[] = []

  if (event.event_date === now.tomorrow && now.minutes >= MORNING) {
    jobs.push(
      hidden
        ? job('day_before', '🎁 Yarın bir sürprizin var', `“${event.teaser}”${time ? ` · ${time}` : ''}`)
        : job('day_before', `⏰ Yarın: ${event.title}`, time ? `Saat ${time}` : 'Gün boyu'),
    )
  }

  if (event.event_date === now.today) {
    if (time) {
      const left = toMinutes(time) - now.minutes
      if (left > 0 && left <= HOUR_BEFORE) {
        jobs.push(
          hidden
            ? job('hour_before', '🎁 Sürprizine az kaldı!', `“${event.teaser}” · ${time}`)
            : job('hour_before', `⏰ ${event.title} birazdan`, `Saat ${time}`),
        )
      }
    } else if (now.minutes >= MORNING) {
      jobs.push(
        hidden
          ? job('same_day', '🎁 Bugün bir sürprizin var', `“${event.teaser}”`)
          : job('same_day', `📅 Bugün: ${event.title}`, event.note ?? 'Gün boyu'),
      )
    }
  }

  if (
    event.surprise &&
    event.reveal_on === now.today &&
    person.id !== event.created_by &&
    now.minutes >= MORNING
  ) {
    const author = people.find((p) => p.id === event.created_by)?.name ?? 'Eşin'
    jobs.push(job('reveal', '🎁 Sürpriz açıldı!', `${author} sana: ${event.title} · ${formatWhen(event)}`))
  }

  return jobs
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }

  const now = istanbulNow()
  const { data: events } = await admin
    .from('events')
    .select('*')
    .or(`event_date.in.(${now.today},${now.tomorrow}),reveal_on.eq.${now.today}`)
  if (!events?.length) return Response.json({ sent: 0 })

  const coupleIds = [...new Set(events.map((e) => e.couple_id))]
  const { data: people } = await admin.from('profiles').select('id, name, couple_id').in('couple_id', coupleIds)

  const jobs = (events as EventRow[]).flatMap((event) => {
    const members = (people as Person[]).filter((p) => p.couple_id === event.couple_id)
    return members.flatMap((person) => due(event, person, members, now))
  })

  let sent = 0
  for (const j of jobs) {
    // Claim first so a slow run never sends the same reminder twice.
    const { error } = await admin
      .from('sent_notifications')
      .insert({ event_id: j.event.id, user_id: j.userId, kind: j.kind })
    if (error) continue
    sent += await sendToUsers([j.userId], j.payload)
  }

  return Response.json({ due: jobs.length, sent })
})
