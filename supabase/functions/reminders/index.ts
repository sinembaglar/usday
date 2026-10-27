// Runs every 10 minutes (pg_cron). Sends what is due right now, each reminder once per person.
import {
  admin,
  asPlan,
  eventUrl,
  formatWhen,
  hiddenFrom,
  peopleIn,
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
  const hidden = hiddenFrom(event, person.id, now.today)
  // On reveal day the surprise opens for whoever it was hidden from.
  const isTarget = event.couple_id ? person.id !== event.created_by : (event.hidden_from ?? []).includes(person.id)
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

  if (event.surprise && event.reveal_on === now.today && isTarget && now.minutes >= MORNING) {
    const author = people.find((p) => p.id === event.created_by)?.name ?? 'Eşin'
    jobs.push(job('reveal', now.today, '🎁 Sürpriz açıldı!', `${author} sana: ${event.title} · ${formatWhen(event)}`))
  }

  return jobs
}

// Each person hears it with the other's name, since they may have several connections.
function milestoneTitle(m: { kind: string; count: number }, relation: string, today: boolean, other: string) {
  const when = today ? 'Bugün' : 'Yarın'
  const n = m.count.toLocaleString('tr-TR')
  const end = today ? '!' : ''
  if (relation === 'friend') {
    return m.kind === 'anniversary'
      ? `🥂 ${when} ${other} ile arkadaşlığınızın ${n}. yılı${end}`
      : `💛 ${when} ${other} ile arkadaşlığınızın ${n}. günü${end}`
  }
  return m.kind === 'anniversary'
    ? `💍 ${when} ${other} ile ${n}. yıldönümünüz${end}`
    : `💜 ${when} ${other} ile birlikte ${n}. gününüz${end}`
}

function milestoneJobs(coupleId: string, since: string, relation: string, members: Person[], now: Now): Job[] {
  if (now.minutes < MORNING || members.length < 2) return []
  const jobs: Job[] = []
  for (const m of milestones(since, now.today, now.tomorrow, relation)) {
    const today = m.date === now.today
    const body = today ? 'Nice güzel günlere 🥂' : 'Küçük bir sürpriz için tam zamanı 🎁'
    for (const person of members) {
      const other = members.find((p) => p.id !== person.id)!.name
      const title = milestoneTitle(m, relation, today, other)
      jobs.push({
        userId: person.id,
        eventId: null,
        claim: { table: 'sent_milestones', row: { couple_id: coupleId, user_id: person.id, key: `${m.kind}:${m.count}:${today ? 'day' : 'eve'}` } },
        // Opens that anniversary in the app (the id the app gives it, see Home).
        payload: {
          title,
          body,
          url: `/?milestone=milestone-${coupleId}-${m.kind}-${m.count}&with=${coupleId}&day=${m.date}`,
          tag: `milestone-${m.kind}-${m.count}`,
        },
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
    admin.from('couples').select('id, together_since, relation').not('together_since', 'is', null),
  ])

  const coupleIds = [
    ...new Set([...(events ?? []).map((e) => e.couple_id).filter(Boolean), ...(couples ?? []).map((c) => c.id)]),
  ]
  const people = await peopleIn(coupleIds)
  const membersOf = (coupleId: string) => people.filter((p) => p.couple_id === coupleId)

  // Group plans remind their maker and everyone who said they are coming.
  const groupIds = (events ?? []).filter((e) => !e.couple_id).map((e) => e.id)
  const { data: going } = groupIds.length
    ? await admin.from('event_participants').select('event_id, user_id').in('event_id', groupIds).eq('status', 'accepted')
    : { data: [] }
  const groupPeopleIds = [
    ...new Set([
      ...(events ?? []).filter((e) => !e.couple_id).map((e) => e.created_by),
      ...(going ?? []).map((g) => g.user_id),
    ]),
  ]
  const { data: groupNames } = groupPeopleIds.length
    ? await admin.from('profiles').select('id, name').in('id', groupPeopleIds)
    : { data: [] }
  const nameOf = (id: string) => (groupNames ?? []).find((p) => p.id === id)?.name ?? ''
  const attendeesOf = (event: EventRow): Person[] =>
    event.couple_id
      ? membersOf(event.couple_id)
      : [event.created_by, ...(going ?? []).filter((g) => g.event_id === event.id).map((g) => g.user_id)].map(
          (id) => ({ id, name: nameOf(id), couple_id: '' }),
        )

  const jobs = [
    ...((events ?? []) as EventRow[]).flatMap((event) =>
      attendeesOf(event).flatMap((person) => eventJobs(event, person, attendeesOf(event), now)),
    ),
    ...(couples ?? []).flatMap((c) => milestoneJobs(c.id, c.together_since, c.relation, membersOf(c.id), now)),
  ]

  // A surprise made from a wish makes that wish come true on its reveal morning.
  if (now.minutes >= MORNING) {
    const revealed = ((events ?? []) as EventRow[]).filter((e) => e.surprise && e.reveal_on === now.today).map((e) => e.id)
    if (revealed.length) {
      const { data: claims } = await admin.from('wish_claims').select('wish_id').in('plan_id', revealed)
      const wishIds = (claims ?? []).map((c) => c.wish_id)
      if (wishIds.length) {
        await admin.from('wishes').update({ status: 'done', done_at: new Date().toISOString() }).in('id', wishIds).eq('status', 'open')
      }
    }
  }

  let sent = 0
  for (const j of jobs) {
    // Claim first so a slow run never sends the same reminder twice.
    const { error } = await admin.from(j.claim.table).insert(j.claim.row)
    if (error) continue
    sent += await sendToUsers([j.userId], j.payload, j.eventId)
  }

  return Response.json({ due: jobs.length, sent })
})
