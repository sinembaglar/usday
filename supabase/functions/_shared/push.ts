import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { asLang, formatDay, type Lang } from './i18n.ts'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

export type Payload = { title: string; body: string; url: string; tag: string }

// A notification is written for its reader: either one text for everyone, or one per language.
export type Message = Payload | ((lang: Lang) => Payload)

export type EventRow = {
  id: string
  couple_id: string
  created_by: string
  title: string
  event_date: string
  event_time: string | null
  end_time: string | null
  location: string | null
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeat_until: string | null
  skip_dates: string[]
  note: string | null
  surprise: boolean
  teaser: string | null
  reveal_on: string | null
  status: 'confirmed' | 'proposed' | 'declined'
  awaiting: string | null
  response_note: string | null
  hidden_from: string[] | null
}

export type Person = { id: string; name: string; couple_id: string; lang: Lang; time_zone: string }

export type Guest = {
  id: string
  name: string
  status: 'maker' | 'pending' | 'accepted' | 'maybe' | 'suggested' | 'declined'
}

// Everyone on a group plan: its maker plus the invited people and their answers.
export async function guestsOf(event: EventRow): Promise<Guest[]> {
  const { data } = await admin
    .from('event_participants')
    .select('user_id, status, profiles(id, name)')
    .eq('event_id', event.id)
  const { data: maker } = await admin.from('profiles').select('id, name').eq('id', event.created_by).single()
  return [
    { id: maker!.id, name: maker!.name, status: 'maker' as const },
    ...(data ?? []).map((p: { status: Guest['status']; profiles: { id: string; name: string } }) => ({
      id: p.profiles.id,
      name: p.profiles.name,
      status: p.status,
    })),
  ]
}

// The (at most two) people in each connection, as Person rows tagged with the connection.
export async function peopleIn(coupleIds: string[]): Promise<Person[]> {
  if (!coupleIds.length) return []
  const { data } = await admin
    .from('couple_members')
    .select('couple_id, profiles(id, name, lang, time_zone)')
    .in('couple_id', coupleIds)
  return (data ?? []).map(
    (m: { couple_id: string; profiles: { id: string; name: string; lang: string; time_zone: string } }) => ({
      id: m.profiles.id,
      name: m.profiles.name,
      couple_id: m.couple_id,
      lang: asLang(m.profiles.lang),
      time_zone: m.profiles.time_zone,
    }),
  )
}

// Unread notifications in the app: the number on the icon.
async function unreadCount(userId: string) {
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient', userId)
    .is('read_at', null)
  return count ?? 0
}

// Each person's language.
export async function languagesOf(userIds: string[]): Promise<Record<string, Lang>> {
  const { data } = await admin.from('profiles').select('id, lang').in('id', userIds)
  return Object.fromEntries((data ?? []).map((p) => [p.id, asLang(p.lang)]))
}

// Keeps the notification in the app's inbox, then sends it to every device of the given people, each in
// their own language. Returns how many devices it reached; subscriptions the push service no longer knows
// are dropped.
export async function sendToUsers(userIds: string[], message: Message, eventId: string | null = null) {
  if (!userIds.length) return 0
  const langs = typeof message === 'function' ? await languagesOf(userIds) : {}
  const payloadFor = (id: string) => (typeof message === 'function' ? message(langs[id] ?? 'tr') : message)
  await admin.from('notifications').insert(
    userIds.map((recipient) => {
      const payload = payloadFor(recipient)
      return { recipient, event_id: eventId, title: payload.title, body: payload.body, url: payload.url }
    }),
  )
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
  const badges = Object.fromEntries(await Promise.all(userIds.map(async (id) => [id, await unreadCount(id)])))
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payloadFor(s.user_id), badge: badges[s.user_id] }),
          { TTL: 60 * 60 * 12, urgency: 'high' },
        )
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        } else {
          console.error('push failed', status, (err as { body?: string }).body)
        }
      }
    }),
  )
  return sent
}

export const shortTime = (time: string | null) => time?.slice(0, 5) ?? ''
export const formatWhen = (e: EventRow, lang: Lang = 'tr') =>
  [formatDay(lang, e.event_date), shortTime(e.event_time)].filter(Boolean).join(' · ')
export const eventUrl = (id: string) => `/?event=${id}`

// Today in Istanbul as YYYY-MM-DD (Türkiye has been UTC+3 all year since 2016).
export const istanbulToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

// A surprise stays hidden until its reveal day: from the partner on a two-person plan,
// from the chosen guests ("kimden gizli") on a group plan.
export const hiddenFrom = (e: EventRow, userId: string, today = istanbulToday()) =>
  e.surprise &&
  (e.reveal_on ?? e.event_date) > today &&
  (e.couple_id ? e.created_by !== userId : (e.hidden_from ?? []).includes(userId))

// Who a surprise is for: the partner, or the group plan's chosen guests.
export const surpriseTargets = (e: EventRow, people: { id: string }[]) =>
  e.couple_id ? people.filter((p) => p.id !== e.created_by).map((p) => p.id) : (e.hidden_from ?? [])

// Database row → the shape the shared recurrence helpers expect.
export const asPlan = (e: EventRow) => ({
  date: e.event_date,
  repeat: e.repeat,
  repeatUntil: e.repeat_until,
  skipDates: e.skip_dates,
})
