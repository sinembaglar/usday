import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

export type Payload = { title: string; body: string; url: string; tag: string }

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
}

export type Person = { id: string; name: string; couple_id: string }

// Unread notifications in the app: the number on the icon.
async function unreadCount(userId: string) {
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient', userId)
    .is('read_at', null)
  return count ?? 0
}

// Keeps the notification in the app's inbox, then sends it to every device of the given people.
// Returns how many devices it reached; subscriptions the push service no longer knows are dropped.
export async function sendToUsers(userIds: string[], payload: Payload, eventId: string | null = null) {
  if (!userIds.length) return 0
  await admin.from('notifications').insert(
    userIds.map((recipient) => ({ recipient, event_id: eventId, title: payload.title, body: payload.body, url: payload.url })),
  )
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
  const badges = Object.fromEntries(await Promise.all(userIds.map(async (id) => [id, await unreadCount(id)])))
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, badge: badges[s.user_id] }),
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

const dayFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' })

export const formatDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`))
export const shortTime = (time: string | null) => time?.slice(0, 5) ?? ''
export const formatWhen = (e: EventRow) => [formatDay(e.event_date), shortTime(e.event_time)].filter(Boolean).join(' · ')
export const eventUrl = (id: string) => `/?event=${id}`

// Today in Istanbul as YYYY-MM-DD (Türkiye has been UTC+3 all year since 2016).
export const istanbulToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

// A surprise stays hidden from the partner until its reveal day.
export const hiddenFrom = (e: EventRow, userId: string, today = istanbulToday()) =>
  e.surprise && e.created_by !== userId && (e.reveal_on ?? e.event_date) > today

// Database row → the shape the shared recurrence helpers expect.
export const asPlan = (e: EventRow) => ({
  date: e.event_date,
  repeat: e.repeat,
  repeatUntil: e.repeat_until,
  skipDates: e.skip_dates,
})
