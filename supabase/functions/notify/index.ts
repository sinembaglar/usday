// Called by the app right after someone adds a plan: tells the partner.
import { admin, eventUrl, formatWhen, sendToUsers, type EventRow, type Person } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth.user) return json({ error: 'unauthorized' }, 401)

  const { event_id } = await req.json().catch(() => ({}))
  const { data: event } = await admin.from('events').select('*').eq('id', event_id).maybeSingle<EventRow>()
  if (!event || event.created_by !== auth.user.id) return json({ error: 'not_found' }, 404)

  const { data: members } = await admin.from('profiles').select('id, name, couple_id').eq('couple_id', event.couple_id)
  const me = (members as Person[]).find((m) => m.id === auth.user.id)!
  const partner = (members as Person[]).find((m) => m.id !== auth.user.id)
  if (!partner) return json({ sent: 0 })

  const when = formatWhen(event)
  const payload = event.surprise
    ? { title: `🎁 ${me.name} bir sürpriz hazırladı`, body: `“${event.teaser}” · ${when}`, url: eventUrl(event.id), tag: event.id }
    : { title: `💌 ${me.name} yeni bir plan ekledi`, body: `${event.title} · ${when}`, url: eventUrl(event.id), tag: event.id }

  return json({ sent: await sendToUsers([partner.id], payload) })
})
