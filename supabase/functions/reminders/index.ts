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

// Turkish genitive, as in the app: "Can’ın", "Ece’nin", "Serhat Han’ın".
function genitive(name: string) {
  const lower = name.toLocaleLowerCase('tr')
  const last = [...lower].filter((c) => 'aeıioöuü'.includes(c)).at(-1) ?? 'e'
  const vowel = ({ a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' } as Record<string, string>)[last]
  const endsWithVowel = 'aeıioöuü'.includes(lower.at(-1) ?? '')
  return `${name}’${endsWithVowel ? 'n' : ''}${vowel}n`
}

// Birthdays: the people someone is connected to hear about it a month, two weeks, a week and a day
// before, and on the morning itself. The birthday person only gets a greeting on the day.
const BIRTHDAY_STEPS = [30, 14, 7, 1, 0]
const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' })
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

// The next birthday on or after today; 29 February falls on the 28th in other years.
function nextBirthday(birthday: string, today: string) {
  const md = birthday.slice(5)
  const on = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    return `${y}-${md === '02-29' && !leap ? '02-28' : md}`
  }
  const year = Number(today.slice(0, 4))
  return on(year) >= today ? on(year) : on(year + 1)
}

function birthdayWords(days: number, who: string, when: string): [string, string] {
  if (days === 30) return [`🎂 ${who} doğum gününe 1 ay var`, `${when}. Bir sürpriz planlamak ya da dilek listesine bakmak için güzel bir zaman.`]
  if (days === 14) return [`🎂 ${who} doğum gününe 2 hafta kaldı`, `${when}. Bir planınız var mı?`]
  if (days === 7) return [`🎂 ${who} doğum gününe 1 hafta kaldı`, `${when}. Hediye ya da plan hazır mı?`]
  if (days === 1) return [`🎂 Yarın ${who} doğum günü`, 'Kutlamaya hazır mısın? 🎉']
  return [`🎂 Bugün ${who} doğum günü`, 'Bir mesaj atmayı unutma 💜']
}

async function birthdayJobs(now: Now): Promise<Job[]> {
  if (now.minutes < MORNING) return []
  const { data: born } = await admin.from('profiles').select('id, name, birthday').not('birthday', 'is', null)
  const due = (born ?? [])
    .map((p) => {
      const date = nextBirthday(p.birthday, now.today)
      return { ...p, date, days: daysBetween(now.today, date) }
    })
    .filter((p) => BIRTHDAY_STEPS.includes(p.days))
  if (!due.length) return []

  const { data: memberships } = await admin.from('couple_members').select('couple_id, user_id').in('user_id', due.map((p) => p.id))
  const people = await peopleIn([...new Set((memberships ?? []).map((m) => m.couple_id))])
  const jobs: Job[] = []
  for (const p of due) {
    const theirs = (memberships ?? []).filter((m) => m.user_id === p.id).map((m) => m.couple_id)
    const friends = [...new Set(people.filter((x) => theirs.includes(x.couple_id) && x.id !== p.id).map((x) => x.id))]
    const year = p.date.slice(0, 4)
    const [title, body] = birthdayWords(p.days, genitive(p.name), dayMonth.format(new Date(`${p.date}T00:00:00Z`)))
    for (const id of friends) {
      jobs.push({
        userId: id,
        eventId: null,
        claim: { table: 'sent_birthdays', row: { person_id: p.id, user_id: id, key: `${p.days}:${year}` } },
        payload: { title, body, url: `/?birthday=${p.id}`, tag: `birthday-${p.id}` },
      })
    }
    if (p.days === 0) {
      jobs.push({
        userId: p.id,
        eventId: null,
        claim: { table: 'sent_birthdays', row: { person_id: p.id, user_id: p.id, key: `self:${year}` } },
        payload: { title: `🎂 İyi ki doğdun, ${p.name}!`, body: 'Sevdiklerin bugün seni kutlayacak 💜', url: '/', tag: 'birthday-self' },
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

  // Group plans remind their maker and everyone who said they are (or might be) coming.
  const groupIds = (events ?? []).filter((e) => !e.couple_id).map((e) => e.id)
  const { data: going } = groupIds.length
    ? await admin
        .from('event_participants')
        .select('event_id, user_id')
        .in('event_id', groupIds)
        .in('status', ['accepted', 'maybe'])
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
    ...(await birthdayJobs(now)),
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
