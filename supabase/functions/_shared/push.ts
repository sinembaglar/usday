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
  note: string | null
  surprise: boolean
  teaser: string | null
  reveal_on: string | null
}

export type Person = { id: string; name: string; couple_id: string }

// Plans the partner added since this person last opened the app (the icon badge).
async function unreadCount(userId: string) {
  const { data: me } = await admin.from('profiles').select('couple_id, last_seen_at').eq('id', userId).single()
  if (!me) return 0
  const { count } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('couple_id', me.couple_id)
    .neq('created_by', userId)
    .gt('created_at', me.last_seen_at)
  return count ?? 0
}

// Sends to every device of the given people; drops subscriptions the push service no longer knows.
export async function sendToUsers(userIds: string[], payload: Payload) {
  if (!userIds.length) return 0
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
