// Called by the app when someone adds a plan, writes a comment or reacts: tells the partner.
import { admin, eventUrl, formatWhen, hiddenFrom, sendToUsers, type EventRow, type Person } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const REACTIONS = ['😍', '🥳', '👍', '😂', '🙈']

async function eventWithPeople(eventId: string) {
  const { data: event } = await admin.from('events').select('*').eq('id', eventId).maybeSingle<EventRow>()
  if (!event) return null
  const { data: members } = await admin.from('profiles').select('id, name, couple_id').eq('couple_id', event.couple_id)
  return { event, members: (members ?? []) as Person[] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))

  // Which plan, and is the caller allowed to talk about it?
  let eventId = body.event_id
  let comment: { body: string } | null = null
  if (body.comment_id) {
    const { data } = await admin.from('event_comments').select('event_id, author, body').eq('id', body.comment_id).maybeSingle()
    if (!data || data.author !== userId) return json({ error: 'not_found' }, 404)
    eventId = data.event_id
    comment = data
  } else if (body.reaction_event_id) {
    if (!REACTIONS.includes(body.emoji)) return json({ error: 'bad_emoji' }, 400)
    eventId = body.reaction_event_id
  }

  const found = eventId && (await eventWithPeople(eventId))
  if (!found) return json({ error: 'not_found' }, 404)
  const { event, members } = found
  const me = members.find((m) => m.id === userId)
  const partner = members.find((m) => m.id !== userId)
  if (!me || hiddenFrom(event, userId)) return json({ error: 'not_found' }, 404)
  if (body.event_id && event.created_by !== userId) return json({ error: 'not_found' }, 404)
  if (!partner) return json({ sent: 0 })

  const url = eventUrl(event.id)
  const when = formatWhen(event)
  let payload

  if (body.event_id) {
    payload = event.surprise
      ? { title: `🎁 ${me.name} bir sürpriz hazırladı`, body: `“${event.teaser}” · ${when}`, url, tag: event.id }
      : { title: `💌 ${me.name} yeni bir plan ekledi`, body: `${event.title} · ${when}`, url, tag: event.id }
  } else {
    // Talking about my own still-hidden surprise must not reach my partner.
    if (hiddenFrom(event, partner.id)) return json({ sent: 0 })
    payload = comment
      ? { title: `💬 ${me.name} · ${event.title}`, body: comment.body.slice(0, 180), url, tag: `${event.id}-chat` }
      : { title: `${body.emoji} ${me.name} planına tepki verdi`, body: event.title, url, tag: `${event.id}-react` }
  }

  return json({ sent: await sendToUsers([partner.id], payload) })
})
