// Called by the app when someone adds or proposes a plan, answers a proposal, writes a comment
// or reacts: tells the partner.
import {
  admin,
  eventUrl,
  formatWhen,
  guestsOf,
  hiddenFrom,
  peopleIn,
  sendToUsers,
  type EventRow,
  type Guest,
} from '../_shared/push.ts'

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

  // Group plans: everyone on the plan hears it, except the person who did it.
  const { data: groupPlan } = eventId
    ? await admin.from('events').select('*').eq('id', eventId).is('couple_id', null).maybeSingle<EventRow>()
    : { data: null }
  if (groupPlan) {
    const guests = await guestsOf(groupPlan)
    const me = guests.find((g) => g.id === userId)
    if (!me) return json({ error: 'not_found' }, 404)
    const url = eventUrl(groupPlan.id)
    const when = formatWhen(groupPlan)
    const others = guests.filter((g) => g.id !== userId)
    const names = (list: Guest[]) => list.map((g) => g.name).join(', ')
    // Guests the plan is still a surprise for; they hear only the teaser, and nothing of the planning.
    const secretFor = new Set(others.filter((g) => hiddenFrom(groupPlan, g.id)).map((g) => g.id))
    const insiders = others.filter((g) => !secretFor.has(g.id))
    const targets = guests.filter((g) => secretFor.has(g.id))
    const forWhom = targets.length ? ` · 🤫 ${names(targets)} için sürpriz` : ''
    if (hiddenFrom(groupPlan, userId) && !body.response_event_id) return json({ error: 'not_found' }, 404)
    let sent = 0

    if (body.event_id) {
      if (groupPlan.created_by !== userId) return json({ error: 'not_found' }, 404)
      const invited = insiders.filter((g) => g.status !== 'maker').map((g) => g.id)
      sent += await sendToUsers(
        invited,
        { title: `👥 ${me.name} seni bir plana davet ediyor`, body: `${groupPlan.title} · ${when}${forWhom} — ${names(others)} davetli`, url, tag: groupPlan.id },
        groupPlan.id,
      )
      sent += await sendToUsers(
        [...secretFor],
        { title: `🎁 ${me.name} seni bir sürpriz için ayırtmak istiyor`, body: `${when} boş musun? “${groupPlan.teaser}”`, url, tag: groupPlan.id },
        groupPlan.id,
      )
    } else if (body.response_event_id) {
      if (me.status !== 'accepted' && me.status !== 'declined') return json({ error: 'not_answered' }, 409)
      // A target's answer is news for the insiders; an insider's answer never reaches a target.
      const coming = me.status === 'accepted'
      sent += await sendToUsers(
        insiders.map((g) => g.id),
        coming
          ? { title: `✅ ${me.name} katılıyor`, body: `${groupPlan.title} · ${when}`, url, tag: `${groupPlan.id}-answer-${userId}` }
          : { title: `❌ ${me.name} katılamıyor`, body: groupPlan.title, url, tag: `${groupPlan.id}-answer-${userId}` },
        groupPlan.id,
      )
    } else {
      sent += await sendToUsers(
        insiders.map((g) => g.id),
        comment
          ? { title: `💬 ${me.name} · ${groupPlan.title}`, body: comment.body.slice(0, 180), url, tag: `${groupPlan.id}-chat` }
          : { title: `${body.emoji} ${me.name} planına tepki verdi`, body: groupPlan.title, url, tag: `${groupPlan.id}-react` },
        groupPlan.id,
      )
    }
    return json({ sent })
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
