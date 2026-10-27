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

// An emoji on a comment, as the comment's author reads it: "😂 Yaren yorumuna güldü".
const COMMENT_REACTIONS: Record<string, string> = {
  '😂': 'yorumuna güldü',
  '😍': 'yorumuna bayıldı',
  '😮': 'yorumuna şaşırdı',
  '😢': 'yorumuna üzüldü',
  '😡': 'yorumuna kızdı',
  '👍': 'yorumunu beğendi',
}

// What a comment says in a notification; a picture or GIF on its own shows as such.
const commentText = (c: { body: string; image_path?: string | null }) => {
  const picture = c.image_path ? (c.image_path.endsWith('.gif') ? '🎞️ GIF' : '📷 Görsel') : ''
  return [picture, c.body.trim()].filter(Boolean).join(' · ')
}

// Turkish genitive, same as the app's: "Sinem’in", "Ayşe’nin", "Serhat Han’ın".
function genitive(name: string) {
  const lower = name.toLocaleLowerCase('tr')
  const last = [...lower].filter((c) => 'aeıioöuü'.includes(c)).at(-1) ?? 'e'
  const vowel = ({ a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' } as Record<string, string>)[last]
  const endsWithVowel = 'aeıioöuü'.includes(lower.at(-1) ?? '')
  return `${name}’${endsWithVowel ? 'n' : ''}${vowel}n`
}

async function eventWithPeople(eventId: string) {
  const { data: event } = await admin.from('events').select('*').eq('id', eventId).maybeSingle<EventRow>()
  if (!event) return null
  return { event, members: await peopleIn([event.couple_id]) }
}

// What the recipient may know about the plan.
const nameFor = (e: EventRow, recipient: string) => (hiddenFrom(e, recipient) ? `🎁 Sürpriz (“${e.teaser}”)` : e.title)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const body = await req.json().catch(() => ({}))

  // The database announces new comments itself (with the shared secret), on behalf of their author.
  let userId: string | undefined
  const fromDatabase = req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')
  if (fromDatabase && body.comment_id) {
    const { data } = await admin.from('event_comments').select('author').eq('id', body.comment_id).maybeSingle()
    userId = data?.author
  } else if (fromDatabase && body.comment_reaction) {
    userId = body.comment_reaction.user_id
  } else if (fromDatabase && body.share_comment_id) {
    const { data } = await admin.from('share_comments').select('author').eq('id', body.share_comment_id).maybeSingle()
    userId = data?.author
  } else {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: auth } = await admin.auth.getUser(token)
    userId = auth.user?.id
  }
  if (!userId) return json({ error: 'unauthorized' }, 401)

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
    const payload = { title: `${icon} ${me?.name} dilek listesine ekledi`, body: wish.title, url: `/?tab=dilekler&wish=${wish.id}`, tag: `wish-${wish.id}` }
    return json({ sent: await sendToUsers(others, payload) })
  }

  // An emoji on someone's comment: its author hears it, once for each emoji (changing back and forth
  // does not ring again).
  if (body.comment_reaction) {
    const share = body.comment_reaction.kind === 'share'
    const commentId = body.comment_reaction.comment_id
    const { data: reaction } = await admin
      .from(share ? 'share_comment_reactions' : 'comment_reactions')
      .select('emoji')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle()
    const words = reaction && COMMENT_REACTIONS[reaction.emoji]
    if (!words) return json({ sent: 0 })
    const { data: c } = await admin.from(share ? 'share_comments' : 'event_comments').select('*').eq('id', commentId).maybeSingle()
    if (!c || c.author === userId) return json({ sent: 0 })
    const { error: told } = await admin
      .from('sent_notifications')
      .insert({ event_id: c.event_id, user_id: c.author, kind: `reaction:${commentId}:${userId}:${reaction.emoji}` })
    if (told) return json({ sent: 0 })
    const { data: me } = await admin.from('profiles').select('name').eq('id', userId).single()
    const url = !share
      ? `/?event=${c.event_id}&chat=1`
      : c.author === c.owner
        ? `/?event=${c.event_id}&about=${c.open ? 'open' : c.viewer}`
        : `/?shared=${c.owner}&event=${c.event_id}`
    const payload = {
      title: `${reaction.emoji} ${me?.name} ${words}`,
      body: `“${commentText(c).slice(0, 160)}”`,
      url,
      tag: `comment-reaction-${commentId}`,
    }
    return json({ sent: await sendToUsers([c.author], payload) })
  }

  // A word about a plan on someone's shared calendar. In the shared conversation the owner and everyone
  // who has joined it hear it (while they still see plan names); in a private one only the other side.
  // A surprise for the calendar's owner is never named to them.
  if (body.share_comment_id) {
    const { data: c } = await admin
      .from('share_comments')
      .select('id, event_id, owner, viewer, author, body, image_path, notified_at, open, created_at')
      .eq('id', body.share_comment_id)
      .maybeSingle()
    if (!c || c.author !== userId) return json({ error: 'not_found' }, 404)
    const { data: first } = await admin
      .from('share_comments')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', c.id)
      .is('notified_at', null)
      .select('id')
    if (!first?.length) return json({ sent: 0 })
    const { data: event } = await admin.from('events').select('*').eq('id', c.event_id).single<EventRow>()
    const { data: me } = await admin.from('profiles').select('name').eq('id', userId).single()

    if (c.open) {
      const { data: earlier } = await admin
        .from('share_comments')
        .select('author')
        .eq('event_id', c.event_id)
        .eq('owner', c.owner)
        .eq('open', true)
        .lt('created_at', c.created_at)
      const { data: shares } = await admin.from('calendar_shares').select('viewer').eq('owner', c.owner).eq('level', 'details')
      const seeing = new Set((shares ?? []).map((s) => s.viewer))
      const joined = [...new Set((earlier ?? []).map((e) => e.author))].filter(
        (id) => id !== c.author && id !== c.owner && seeing.has(id),
      )
      const { data: owner } = await admin.from('profiles').select('name').eq('id', c.owner).single()
      const text = commentText(c).slice(0, 180)
      const tag = `share-chat-${c.event_id}-open`
      let sent = 0
      if (c.author !== c.owner) {
        const plan = hiddenFrom(event!, c.owner) ? 'bir planın' : `“${event!.title}” planın`
        sent += await sendToUsers([c.owner], {
          title: `💬 ${me?.name}, ${plan} hakkında yazdı`,
          body: text,
          url: `/?event=${c.event_id}&about=open`,
          tag,
        })
      }
      if (joined.length) {
        sent += await sendToUsers(joined, {
          title:
            c.author === c.owner
              ? `💬 ${me?.name} cevap verdi · “${event!.title}”`
              : `💬 ${me?.name}, ${genitive(owner?.name ?? '')} “${event!.title}” planı hakkında yazdı`,
          body: text,
          url: `/?shared=${c.owner}&event=${c.event_id}`,
          tag,
        })
      }
      return json({ sent })
    }

    const toOwner = c.author === c.viewer
    const recipient = toOwner ? c.owner : c.viewer
    const { data: share } = await admin.from('calendar_shares').select('level').eq('owner', c.owner).eq('viewer', c.viewer).maybeSingle()
    // The owner knows their plan by name (unless it is a surprise for them); the viewer only if they see names.
    const plan = toOwner
      ? hiddenFrom(event!, c.owner)
        ? 'bir planın'
        : `“${event!.title}” planın`
      : share?.level === 'details' && !event!.surprise
        ? `“${event!.title}”`
        : 'takvimindeki plan'
    const payload = {
      title: toOwner ? `💬 ${me?.name}, ${plan} hakkında yazdı` : `💬 ${me?.name} cevap verdi · ${plan}`,
      body: commentText(c).slice(0, 180),
      url: toOwner ? `/?event=${c.event_id}&about=${c.viewer}` : `/?shared=${c.owner}&event=${c.event_id}`,
      tag: `share-chat-${c.event_id}-${c.viewer}`,
    }
    return json({ sent: await sendToUsers([recipient], payload) })
  }

  // I started sharing my calendar with someone: tell them.
  if (body.share_viewer) {
    const { data: share } = await admin
      .from('calendar_shares')
      .select('level')
      .eq('owner', userId)
      .eq('viewer', body.share_viewer)
      .maybeSingle()
    if (!share) return json({ error: 'not_found' }, 404)
    const { data: me } = await admin.from('profiles').select('name').eq('id', userId).single()
    const payload = {
      title: `📅 ${me?.name} takvimini seninle paylaştı`,
      body:
        share.level === 'details'
          ? 'Planlarının adlarını ve saatlerini görebilirsin; boş olduğu bir zamana plan önerebilirsin.'
          : 'Dolu olduğu saatleri görebilirsin; boş olduğu bir zamana plan önerebilirsin.',
      url: `/?person=${userId}`,
      tag: `share-${userId}`,
    }
    return json({ sent: await sendToUsers([body.share_viewer], payload) })
  }

  // "Test bildirimi gönder" in settings: only to my own devices.
  if (body.test) {
    const payload = { title: '🔔 Test bildirimi', body: 'Bildirimler bu cihazda çalışıyor 💜', url: '/', tag: 'test' }
    return json({ sent: await sendToUsers([userId], payload) })
  }

  // Someone is getting a wish: everyone else who can see it hears it, so it is not bought twice;
  // with the claimer's name, or only "biri" when they keep it hidden. The wish owner is never told.
  if (body.claim_wish_id) {
    const { data: claim } = await admin.from('wish_claims').select('claimed_by, shared').eq('wish_id', body.claim_wish_id).maybeSingle()
    if (!claim || claim.claimed_by !== userId) return json({ error: 'not_found' }, 404)
    const { data: wish } = await admin.from('wishes').select('id, owner, title').eq('id', body.claim_wish_id).single()
    const { data: theirs } = await admin.from('couple_members').select('couple_id').eq('user_id', wish!.owner)
    const people = await peopleIn((theirs ?? []).map((m) => m.couple_id))
    const name = (id: string) => people.find((p) => p.id === id)?.name
    const { data: me } = await admin.from('profiles').select('name').eq('id', userId).single()
    const others = [...new Set(people.map((p) => p.id))].filter((id) => id !== wish!.owner && id !== userId)
    const ownerName = name(wish!.owner) ?? ''
    const payload = {
      title: claim.shared ? `🎁 ${me?.name} bunu alıyor` : '🔒 Biri bunu alıyor',
      body: `${genitive(ownerName)} dileği: ${wish!.title} — ${ownerName} bilmiyor 🤫`,
      url: `/?tab=dilekler&wish=${wish!.id}`,
      tag: `claim-${wish!.id}`,
    }
    return json({ sent: await sendToUsers(others, payload) })
  }

  // New feedback or a report: tells the admins. Only its sender can announce it.
  if (body.feedback_id || body.report_id) {
    const { data: item } = body.feedback_id
      ? await admin.from('feedback').select('author, kind, message').eq('id', body.feedback_id).maybeSingle()
      : await admin.from('reports').select('reporter, reason, message').eq('id', body.report_id).maybeSingle()
    if (!item || (item.author ?? item.reporter) !== userId) return json({ error: 'not_found' }, 404)
    const { data: admins } = await admin.from('admins').select('user_id')
    const { data: me } = await admin.from('profiles').select('name').eq('id', userId).single()
    const payload = body.feedback_id
      ? {
          title: `${{ idea: '💡', bug: '🐞', love: '💜' }[item.kind as string] ?? '💬'} ${me?.name} geri bildirim gönderdi`,
          body: item.message.slice(0, 180),
          url: '/?admin=feedback',
          tag: `feedback-${body.feedback_id}`,
        }
      : { title: `🚩 Yeni şikayet`, body: (item.message ?? '').slice(0, 180) || 'Yönetim panelinde incele', url: '/?admin=reports', tag: `report-${body.report_id}` }
    return json({ sent: await sendToUsers((admins ?? []).map((a) => a.user_id), payload) })
  }

  // Which plan, and is the caller allowed to talk about it?
  let eventId = body.event_id ?? body.response_event_id ?? body.moved_event_id
  let comment: { body: string } | null = null
  if (body.comment_id) {
    const { data } = await admin
      .from('event_comments')
      .select('event_id, author, body, image_path')
      .eq('id', body.comment_id)
      .maybeSingle()
    if (!data || data.author !== userId) return json({ error: 'not_found' }, 404)
    // Only once per comment, whoever asks first (the database or an older app version).
    const { data: first } = await admin
      .from('event_comments')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', body.comment_id)
      .is('notified_at', null)
      .select('id')
    if (!first?.length) return json({ sent: 0 })
    eventId = data.event_id
    comment = { body: commentText(data) }
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
      if (me.status === 'pending') return json({ error: 'not_answered' }, 409)
      // A target's answer is news for the insiders; an insider's answer never reaches a target.
      const { data: answer } = await admin
        .from('event_participants')
        .select('note, suggested_date, suggested_time')
        .eq('event_id', groupPlan.id)
        .eq('user_id', userId)
        .single()
      const note = answer?.note ? ` · “${answer.note}”` : ''
      const tag = `${groupPlan.id}-answer-${userId}`
      const suggestedWhen = answer?.suggested_date
        ? formatWhen({ ...groupPlan, event_date: answer.suggested_date, event_time: answer.suggested_time })
        : ''
      const payload = {
        accepted: { title: `✅ ${me.name} katılıyor`, body: `${groupPlan.title} · ${when}${note}`, url, tag },
        maybe: { title: `🤔 ${me.name} belki katılır`, body: `${groupPlan.title}${note}`, url, tag },
        suggested: { title: `🕐 ${me.name} başka zaman öneriyor`, body: `${suggestedWhen} olur mu? · ${groupPlan.title}${note}`, url, tag },
        declined: { title: `❌ ${me.name} katılamıyor`, body: `${groupPlan.title}${note}`, url, tag },
      }[me.status as string]
      if (!payload) return json({ error: 'bad_answer' }, 400)
      // A suggested time is a question for the maker; other answers are news for everyone in on it.
      const to = me.status === 'suggested' ? insiders.filter((g) => g.status === 'maker') : insiders
      sent += await sendToUsers(to.map((g) => g.id), payload, groupPlan.id)
    } else if (body.moved_event_id) {
      // The maker moved the plan to a new time: everyone is asked again.
      if (groupPlan.created_by !== userId) return json({ error: 'not_found' }, 404)
      sent += await sendToUsers(
        insiders.map((g) => g.id),
        { title: `🕐 ${me.name} planı yeni bir zamana taşıdı`, body: `${groupPlan.title} · ${when} — gelebiliyor musun?`, url, tag: `${groupPlan.id}-moved` },
        groupPlan.id,
      )
      sent += await sendToUsers(
        [...secretFor],
        { title: `🎁 ${me.name} sürprizin zamanını değiştirdi`, body: `${when} boş musun? “${groupPlan.teaser}”`, url, tag: `${groupPlan.id}-moved` },
        groupPlan.id,
      )
    } else {
      sent += await sendToUsers(
        insiders.map((g) => g.id),
        comment
          ? { title: `💬 ${me.name} · ${groupPlan.title}`, body: comment.body.slice(0, 180), url: `${url}&chat=1`, tag: `${groupPlan.id}-chat` }
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
      ? { title: `💬 ${me.name} · ${event.title}`, body: comment.body.slice(0, 180), url: `${url}&chat=1`, tag: `${event.id}-chat` }
      : { title: `${body.emoji} ${me.name} planına tepki verdi`, body: event.title, url, tag: `${event.id}-react` }
  }

  return json({ sent: await sendToUsers([partner.id], payload, event.id) })
})
