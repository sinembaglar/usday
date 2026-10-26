// Called by the app when someone adds or proposes a plan, answers a proposal, writes a comment
// or reacts: tells the partner.
import { admin, eventUrl, formatWhen, hiddenFrom, peopleIn, sendToUsers, type EventRow } from '../_shared/push.ts'

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
  return { event, members: await peopleIn([event.couple_id]) }
}

// What the recipient may know about the plan.
const nameFor = (e: EventRow, recipient: string) => (hiddenFrom(e, recipient) ? `🎁 Sürpriz (“${e.teaser}”)` : e.title)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))

  // A new wish: tell everyone the owner is connected with (a good gift idea). Claims are never mentioned.
  if (body.wish_id) {
    const { data: wish } = await admin.from('wishes').select('id, owner, title, category').eq('id', body.wish_id).maybeSingle()
    if (!wish || wish.owner !== userId) return json({ error: 'not_found' }, 404)
    const { data: mine } = await admin.from('couple_members').select('couple_id').eq('user_id', userId)
    const people = await peopleIn((mine ?? []).map((m) => m.couple_id))
    const me = people.find((p) => p.id === userId)
    const others = [...new Set(people.filter((p) => p.id !== userId).map((p) => p.id))]
    if (!others.length) return json({ sent: 0 })
    const icon = { gift: '🎁', travel: '✈️', experience: '🍽️' }[wish.category as string] ?? '🎁'
    const payload = { title: `${icon} ${me?.name} dilek listesine ekledi`, body: wish.title, url: '/?tab=dilekler', tag: `wish-${wish.id}` }
    return json({ sent: await sendToUsers(others, payload) })
  }

  // Which plan, and is the caller allowed to talk about it?
  let eventId = body.event_id ?? body.response_event_id
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
  if (!me) return json({ error: 'not_found' }, 404)
  if (!partner) return json({ sent: 0 })

  const url = eventUrl(event.id)
  const when = formatWhen(event)
  let payload

  if (body.event_id) {
    // A new plan or proposal: only its creator announces it.
    if (event.created_by !== userId) return json({ error: 'not_found' }, 404)
    const asking = event.status === 'proposed'
    payload = event.surprise
      ? asking
        ? { title: `🎁 ${me.name} seni bir sürpriz için ayırtmak istiyor`, body: `${when} uygun musun? “${event.teaser}”`, url, tag: event.id }
        : { title: `🎁 ${me.name} bir sürpriz hazırladı`, body: `“${event.teaser}” · ${when}`, url, tag: event.id }
      : asking
        ? { title: `📨 ${me.name} bir plan teklif ediyor`, body: `${event.title} · ${when} — uygun musun?`, url, tag: event.id }
        : { title: `💌 ${me.name} yeni bir plan ekledi`, body: `${event.title} · ${when}`, url, tag: event.id }
  } else if (body.response_event_id) {
    // An answer to a proposal goes to whoever asked; the caller must have just answered it.
    if (event.status === 'proposed' && event.awaiting === userId) return json({ error: 'not_answered' }, 409)
    const plan = nameFor(event, partner.id)
    const note = event.response_note ? ` · “${event.response_note}”` : ''
    payload =
      event.status === 'confirmed'
        ? { title: `✅ ${me.name} uygun!`, body: `${plan} · ${when}${note}`, url, tag: `${event.id}-answer` }
        : event.status === 'declined'
          ? { title: `❌ ${me.name} o zaman uygun değil`, body: `${plan}${note}`, url, tag: `${event.id}-answer` }
          : { title: `🕐 ${me.name} başka bir zaman önerdi`, body: `${plan} · ${when}${note}`, url, tag: `${event.id}-answer` }
  } else {
    // Talking about a still-hidden surprise must not reach the person it is hidden from.
    if (hiddenFrom(event, userId) || hiddenFrom(event, partner.id)) return json({ sent: 0 })
    payload = comment
      ? { title: `💬 ${me.name} · ${event.title}`, body: comment.body.slice(0, 180), url, tag: `${event.id}-chat` }
      : { title: `${body.emoji} ${me.name} planına tepki verdi`, body: event.title, url, tag: `${event.id}-react` }
  }

  return json({ sent: await sendToUsers([partner.id], payload, event.id) })
})
