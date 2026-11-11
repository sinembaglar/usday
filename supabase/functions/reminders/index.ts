// Runs every 10 minutes (pg_cron). Sends what is due right now, each reminder once per person, in each
// person's language and on their own clock (a plan at 20:00 is reminded at 19:00 wherever they are).
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
import { asLang, clockIn, formatDay, genitive, num, ordinal, say, type Clock, type Lang } from '../_shared/i18n.ts'

const MORNING = 9 * 60 // day-before, same-day, reveal and milestone reminders go out from 09:00
const HOUR_BEFORE = 60

// One clock per time zone for this run.
const clocks = new Map<string, Clock>()
function clockOf(timeZone: string) {
  if (!clocks.has(timeZone)) clocks.set(timeZone, clockIn(timeZone))
  return clocks.get(timeZone)!
}

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const occursOn = (event: EventRow, date: string) => occurrences(asPlan(event), date, date).length > 0

type Job = {
  userId: string
  eventId: string | null
  claim: { table: string; row: Record<string, string> }
  payload: Payload
}

function eventJobs(event: EventRow, person: Person, people: Person[]): Job[] {
  const now = clockOf(person.time_zone)
  const lang = person.lang
  const hidden = hiddenFrom(event, person.id, now.today)
  // On reveal day the surprise opens for whoever it was hidden from.
  const isTarget = event.couple_id ? person.id !== event.created_by : (event.hidden_from ?? []).includes(person.id)
  const time = shortTime(event.event_time)
  const span = event.end_time ? `${time}–${shortTime(event.end_time)}` : time
  const place = event.location ? ` · 📍 ${event.location}` : ''
  const allDay = say(lang, 'Gün boyu', 'All day')
  const at = (t: string) => say(lang, `Saat ${t}`, `At ${t}`)
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
        ? job('day_before', now.tomorrow, say(lang, '🎁 Yarın bir sürprizin var', '🎁 You have a surprise tomorrow'), `“${event.teaser}”${time ? ` · ${time}` : ''}`)
        : job('day_before', now.tomorrow, say(lang, `⏰ Yarın: ${event.title}`, `⏰ Tomorrow: ${event.title}`), (span ? at(span) : allDay) + place),
    )
  }

  if (occursOn(event, now.today)) {
    if (time) {
      const left = toMinutes(time) - now.minutes
      if (left > 0 && left <= HOUR_BEFORE) {
        jobs.push(
          hidden
            ? job('hour_before', now.today, say(lang, '🎁 Sürprizine az kaldı!', '🎁 Your surprise is almost here!'), `“${event.teaser}” · ${time}`)
            : job('hour_before', now.today, say(lang, `⏰ ${event.title} birazdan`, `⏰ Coming up: ${event.title}`), at(span) + place),
        )
      }
    } else if (now.minutes >= MORNING) {
      jobs.push(
        hidden
          ? job('same_day', now.today, say(lang, '🎁 Bugün bir sürprizin var', '🎁 You have a surprise today'), `“${event.teaser}”`)
          : job('same_day', now.today, say(lang, `📅 Bugün: ${event.title}`, `📅 Today: ${event.title}`), (event.note ?? allDay) + place),
      )
    }
  }

  if (event.surprise && event.reveal_on === now.today && isTarget && now.minutes >= MORNING) {
    const author = people.find((p) => p.id === event.created_by)?.name ?? say(lang, 'Biri', 'Someone')
    jobs.push(
      job(
        'reveal',
        now.today,
        say(lang, '🎁 Sürpriz açıldı!', '🎁 Your surprise is revealed!'),
        say(lang, `${author} sana: ${event.title} · ${formatWhen(event, lang)}`, `From ${author}: ${event.title} · ${formatWhen(event, lang)}`),
      ),
    )
  }

  return jobs
}

// Each person hears it with the other's name, since they may have several connections.
function milestoneTitle(m: { kind: string; count: number }, relation: string, today: boolean, other: string, lang: Lang) {
  const end = today ? '!' : ''
  if (lang === 'en') {
    const when = today ? 'Today' : 'Tomorrow'
    if (relation === 'friend') {
      return m.kind === 'anniversary'
        ? `🥂 ${when}: ${ordinal(lang, m.count)} year of friendship with ${other}${end}`
        : `💛 ${when}: day ${num(lang, m.count)} of your friendship with ${other}${end}`
    }
    return m.kind === 'anniversary'
      ? `💍 ${when}: your ${ordinal(lang, m.count)} anniversary with ${other}${end}`
      : `💜 ${when}: your ${ordinal(lang, m.count)} day together with ${other}${end}`
  }
  const when = today ? 'Bugün' : 'Yarın'
  const n = num(lang, m.count)
  if (relation === 'friend') {
    return m.kind === 'anniversary'
      ? `🥂 ${when} ${other} ile arkadaşlığınızın ${n}. yılı${end}`
      : `💛 ${when} ${other} ile arkadaşlığınızın ${n}. günü${end}`
  }
  return m.kind === 'anniversary'
    ? `💍 ${when} ${other} ile ${n}. yıldönümünüz${end}`
    : `💜 ${when} ${other} ile birlikte ${n}. gününüz${end}`
}

function milestoneJobs(coupleId: string, since: string, relation: string, members: Person[]): Job[] {
  if (members.length < 2) return []
  const jobs: Job[] = []
  for (const person of members) {
    const now = clockOf(person.time_zone)
    if (now.minutes < MORNING) continue
    const other = members.find((p) => p.id !== person.id)!.name
    for (const m of milestones(since, now.today, now.tomorrow, relation)) {
      const today = m.date === now.today
      const lang = person.lang
      jobs.push({
        userId: person.id,
        eventId: null,
        claim: { table: 'sent_milestones', row: { couple_id: coupleId, user_id: person.id, key: `${m.kind}:${m.count}:${today ? 'day' : 'eve'}` } },
        // Opens that anniversary in the app (the id the app gives it, see Home).
        payload: {
          title: milestoneTitle(m, relation, today, other, lang),
          body: today
            ? say(lang, 'Nice güzel günlere 🥂', 'Here’s to many more 🥂')
            : say(lang, 'Küçük bir sürpriz için tam zamanı 🎁', 'Just the time for a little surprise 🎁'),
          url: `/?milestone=milestone-${coupleId}-${m.kind}-${m.count}&with=${coupleId}&day=${m.date}`,
          tag: `milestone-${m.kind}-${m.count}`,
        },
      })
    }
  }
  return jobs
}

// Birthdays: the people someone is connected to hear about it a month, two weeks, a week and a day
// before, and on the morning itself. The birthday person only gets a greeting on the day.
const BIRTHDAY_STEPS = [30, 14, 7, 1, 0]
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

function birthdayWords(lang: Lang, days: number, name: string, when: string): [string, string] {
  if (lang === 'en') {
    if (days === 30) return [`🎂 ${name}’s birthday is a month away`, `${when}. A good time to plan a surprise or look at their wish list.`]
    if (days === 14) return [`🎂 ${name}’s birthday is in 2 weeks`, `${when}. Got a plan?`]
    if (days === 7) return [`🎂 ${name}’s birthday is in a week`, `${when}. Is the gift or the plan ready?`]
    if (days === 1) return [`🎂 It’s ${name}’s birthday tomorrow`, 'Ready to celebrate? 🎉']
    return [`🎂 It’s ${name}’s birthday today`, 'Don’t forget to send a message 💜']
  }
  const who = genitive(name)
  if (days === 30) return [`🎂 ${who} doğum gününe 1 ay var`, `${when}. Bir sürpriz planlamak ya da dilek listesine bakmak için güzel bir zaman.`]
  if (days === 14) return [`🎂 ${who} doğum gününe 2 hafta kaldı`, `${when}. Bir planınız var mı?`]
  if (days === 7) return [`🎂 ${who} doğum gününe 1 hafta kaldı`, `${when}. Hediye ya da plan hazır mı?`]
  if (days === 1) return [`🎂 Yarın ${who} doğum günü`, 'Kutlamaya hazır mısın? 🎉']
  return [`🎂 Bugün ${who} doğum günü`, 'Bir mesaj atmayı unutma 💜']
}

async function birthdayJobs(): Promise<Job[]> {
  // Somewhere it is already tomorrow or still yesterday: look at birthdays near any step from yesterday (UTC).
  const base = addDays(new Date().toISOString().slice(0, 10), -1)
  const { data: born } = await admin.from('profiles').select('id, name, birthday, lang, time_zone').not('birthday', 'is', null)
  const near = (born ?? []).filter((p) => {
    const fromBase = daysBetween(base, nextBirthday(p.birthday, base))
    return BIRTHDAY_STEPS.some((s) => [0, 1, 2].includes(fromBase - s))
  })
  if (!near.length) return []

  const { data: memberships } = await admin.from('couple_members').select('couple_id, user_id').in('user_id', near.map((p) => p.id))
  const people = await peopleIn([...new Set((memberships ?? []).map((m) => m.couple_id))])
  const jobs: Job[] = []
  for (const p of near) {
    const theirs = (memberships ?? []).filter((m) => m.user_id === p.id).map((m) => m.couple_id)
    const friends = [...new Map(people.filter((x) => theirs.includes(x.couple_id) && x.id !== p.id).map((x) => [x.id, x])).values()]
    // Each friend counts the days on their own clock.
    for (const friend of friends) {
      const now = clockOf(friend.time_zone)
      if (now.minutes < MORNING) continue
      const date = nextBirthday(p.birthday, now.today)
      const days = daysBetween(now.today, date)
      if (!BIRTHDAY_STEPS.includes(days)) continue
      const [title, body] = birthdayWords(friend.lang, days, p.name, formatDay(friend.lang, date))
      jobs.push({
        userId: friend.id,
        eventId: null,
        claim: { table: 'sent_birthdays', row: { person_id: p.id, user_id: friend.id, key: `${days}:${date.slice(0, 4)}` } },
        payload: { title, body, url: `/?birthday=${p.id}`, tag: `birthday-${p.id}` },
      })
    }
    const own = clockOf(p.time_zone)
    const lang = asLang(p.lang)
    if (own.minutes >= MORNING && nextBirthday(p.birthday, own.today) === own.today) {
      jobs.push({
        userId: p.id,
        eventId: null,
        claim: { table: 'sent_birthdays', row: { person_id: p.id, user_id: p.id, key: `self:${own.today.slice(0, 4)}` } },
        payload: {
          title: say(lang, `🎂 İyi ki doğdun, ${p.name}!`, `🎂 Happy birthday, ${p.name}!`),
          body: say(lang, 'Sevdiklerin bugün seni kutlayacak 💜', 'Your people will be celebrating you today 💜'),
          url: '/',
          tag: 'birthday-self',
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

  // Plans from yesterday to the day after tomorrow (UTC) cover today and tomorrow in every time zone.
  const utcToday = new Date().toISOString().slice(0, 10)
  const days = [-1, 0, 1, 2].map((n) => addDays(utcToday, n))
  const [{ data: events }, { data: couples }] = await Promise.all([
    admin
      .from('events')
      .select('*')
      .eq('status', 'confirmed') // an unanswered or declined proposal is not a plan yet
      .or(`event_date.in.(${days.join(',')}),reveal_on.in.(${days.slice(0, 3).join(',')}),repeat.neq.none`),
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
  const { data: groupProfiles } = groupPeopleIds.length
    ? await admin.from('profiles').select('id, name, lang, time_zone').in('id', groupPeopleIds)
    : { data: [] }
  const groupPerson = (id: string): Person => {
    const p = (groupProfiles ?? []).find((x) => x.id === id)
    return { id, name: p?.name ?? '', couple_id: '', lang: asLang(p?.lang), time_zone: p?.time_zone ?? 'Europe/Istanbul' }
  }
  const attendeesOf = (event: EventRow): Person[] =>
    event.couple_id
      ? membersOf(event.couple_id)
      : [event.created_by, ...(going ?? []).filter((g) => g.event_id === event.id).map((g) => g.user_id)].map(groupPerson)

  const jobs = [
    ...((events ?? []) as EventRow[]).flatMap((event) =>
      attendeesOf(event).flatMap((person) => eventJobs(event, person, attendeesOf(event))),
    ),
    ...(couples ?? []).flatMap((c) => milestoneJobs(c.id, c.together_since, c.relation, membersOf(c.id))),
    ...(await birthdayJobs()),
  ]

  // A surprise made from a wish makes that wish come true on its reveal morning (Istanbul time).
  const istanbul = clockOf('Europe/Istanbul')
  if (istanbul.minutes >= MORNING) {
    const revealed = ((events ?? []) as EventRow[]).filter((e) => e.surprise && e.reveal_on === istanbul.today).map((e) => e.id)
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
