// Runs every 10 minutes (pg_cron). Sends what is due right now, each reminder once per person.
import {
  admin,
  asPlan,
  eventUrl,
  formatWhen,
  sendToUsers,
  shortTime,
  type EventRow,
  type Payload,
  type Person,
} from '../_shared/push.ts'
import { milestones, occurrences } from '../_shared/recurrence.ts'

const MORNING = 9 * 60 // day-before, same-day, reveal and milestone reminders go out from 09:00
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

type Now = ReturnType<typeof istanbulNow>

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const occursOn = (event: EventRow, date: string) => occurrences(asPlan(event), date, date).length > 0

type Job = {
  userId: string
  eventId: string | null
  claim: { table: string; row: Record<string, string> }
  payload: Payload
}

function eventJobs(event: EventRow, person: Person, people: Person[], now: Now): Job[] {
  const hidden = event.surprise && person.id !== event.created_by && (event.reveal_on ?? event.event_date) > now.today
  const time = shortTime(event.event_time)
  const span = event.end_time ? `${time}–${shortTime(event.end_time)}` : time
  const place = event.location ? ` · 📍 ${event.location}` : ''
  const repeating = event.repeat !== 'none'
  const job = (kind: string, date: string, title: string, body: string): Job => ({
    userId: person.id,
    eventId: event.id,
    // A repeating plan gets a fresh reminder for every day it happens.
    claim: { table: 'sent_notifications', row: { event_id: event.id, user_id: person.id, kind: repeating ? `${kind}:${date}` : kind } },
    payload: { title, body, url: eventUrl(event.id), tag: `${event.id}-${kind}` },
  })
  const jobs: Job[] = []

  if (occursOn(event, now.tomorrow) && now.minutes >= MORNING) {
    jobs.push(
      hidden
        ? job('day_before', now.tomorrow, '🎁 Yarın bir sürprizin var', `“${event.teaser}”${time ? ` · ${time}` : ''}`)
        : job('day_before', now.tomorrow, `⏰ Yarın: ${event.title}`, (span ? `Saat ${span}` : 'Gün boyu') + place),
    )
  }

  if (occursOn(event, now.today)) {
    if (time) {
      const left = toMinutes(time) - now.minutes
      if (left > 0 && left <= HOUR_BEFORE) {
        jobs.push(
          hidden
            ? job('hour_before', now.today, '🎁 Sürprizine az kaldı!', `“${event.teaser}” · ${time}`)
            : job('hour_before', now.today, `⏰ ${event.title} birazdan`, `Saat ${span}${place}`),
        )
      }
    } else if (now.minutes >= MORNING) {
      jobs.push(
        hidden
          ? job('same_day', now.today, '🎁 Bugün bir sürprizin var', `“${event.teaser}”`)
          : job('same_day', now.today, `📅 Bugün: ${event.title}`, (event.note ?? 'Gün boyu') + place),
      )
    }
  }

  if (event.surprise && event.reveal_on === now.today && person.id !== event.created_by && now.minutes >= MORNING) {
    const author = people.find((p) => p.id === event.created_by)?.name ?? 'Eşin'
    jobs.push(job('reveal', now.today, '🎁 Sürpriz açıldı!', `${author} sana: ${event.title} · ${formatWhen(event)}`))
  }

  return jobs
}

function milestoneJobs(coupleId: string, since: string, members: Person[], now: Now): Job[] {
  if (now.minutes < MORNING) return []
  const jobs: Job[] = []
  for (const m of milestones(since, now.today, now.tomorrow)) {
    const today = m.date === now.today
    const title =
      m.kind === 'anniversary'
        ? today
          ? `💍 Bugün ${m.count}. yıldönümünüz!`
          : `💍 Yarın ${m.count}. yıldönümünüz`
        : today
          ? `💜 Bugün birlikte ${m.count.toLocaleString('tr-TR')}. gününüz!`
          : `💜 Yarın birlikte ${m.count.toLocaleString('tr-TR')}. gününüz`
    const body = today ? 'Nice güzel günlere 🥂' : 'Küçük bir sürpriz için tam zamanı 🎁'
    for (const person of members) {
      jobs.push({
        userId: person.id,
        eventId: null,
        claim: { table: 'sent_milestones', row: { couple_id: coupleId, user_id: person.id, key: `${m.kind}:${m.count}:${today ? 'day' : 'eve'}` } },
        payload: { title, body, url: '/', tag: `milestone-${m.kind}-${m.count}` },
      })
    }
  }
  return jobs
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }

  const now = istanbulNow()
  const [{ data: events }, { data: couples }] = await Promise.all([
    admin
      .from('events')
      .select('*')
      .eq('status', 'confirmed') // an unanswered or declined proposal is not a plan yet
      .or(`event_date.in.(${now.today},${now.tomorrow}),reveal_on.eq.${now.today},repeat.neq.none`),
    admin.from('couples').select('id, together_since').not('together_since', 'is', null),
  ])

  const coupleIds = [...new Set([...(events ?? []).map((e) => e.couple_id), ...(couples ?? []).map((c) => c.id)])]
  if (!coupleIds.length) return Response.json({ due: 0, sent: 0 })
  const { data: people } = await admin.from('profiles').select('id, name, couple_id').in('couple_id', coupleIds)
  const membersOf = (coupleId: string) => (people as Person[]).filter((p) => p.couple_id === coupleId)

  const jobs = [
    ...((events ?? []) as EventRow[]).flatMap((event) =>
      membersOf(event.couple_id).flatMap((person) => eventJobs(event, person, membersOf(event.couple_id), now)),
    ),
    ...(couples ?? []).flatMap((c) => milestoneJobs(c.id, c.together_since, membersOf(c.id), now)),
  ]

  let sent = 0
  for (const j of jobs) {
    // Claim first so a slow run never sends the same reminder twice.
    const { error } = await admin.from(j.claim.table).insert(j.claim.row)
    if (error) continue
    sent += await sendToUsers([j.userId], j.payload, j.eventId)
  }

  return Response.json({ due: jobs.length, sent })
})
