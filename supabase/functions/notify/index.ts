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
import { genitive, say, type Lang } from '../_shared/i18n.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const REACTIONS = ['😍', '🥳', '👍', '😂', '🙈']

// An emoji on a comment, as the comment's author reads it: "😂 Yaren yorumuna güldü".
const COMMENT_REACTIONS: Record<string, [string, string]> = {
  '😂': ['yorumuna güldü', 'laughed at your comment'],
  '😍': ['yorumuna bayıldı', 'loved your comment'],
  '😮': ['yorumuna şaşırdı', 'was surprised by your comment'],
  '😢': ['yorumuna üzüldü', 'was moved by your comment'],
  '😡': ['yorumuna kızdı', 'was angry about your comment'],
  '👍': ['yorumunu beğendi', 'liked your comment'],
}

// What a comment says in a notification; a picture or GIF on its own shows as such.
const commentText = (c: { body: string; image_path?: string | null }, lang: Lang) => {
  const picture = c.image_path ? (c.image_path.endsWith('.gif') ? '🎞️ GIF' : say(lang, '📷 Görsel', '📷 Photo')) : ''
  return [picture, c.body.trim()].filter(Boolean).join(' · ')
}

async function eventWithPeople(eventId: string) {
  const { data: event } = await admin.from('events').select('*').eq('id', eventId).maybeSingle<EventRow>()
  if (!event) return null
  return { event, members: await peopleIn([event.couple_id]) }
}

// What the recipient may know about the plan.
const nameFor = (e: EventRow, recipient: string, lang: Lang) =>
  hiddenFrom(e, recipient) ? `${say(lang, '🎁 Sürpriz', '🎁 Surprise')} (“${e.teaser}”)` : e.title

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const body = await req.json().catch(() => ({}))

  // The database announces new comments itself (with the shared secret), on behalf of their author.
  let userId: string | undefined
  const fromDatabase = req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')

  // A new kind of error in someone's app (the database sends the first of each kind in a day): tell the admins.
  if (fromDatabase && body.client_error_id) {
    const { data: e } = await admin.from('client_errors').select('message').eq('id', body.client_error_id).maybeSingle()
    if (!e) return json({ error: 'not_found' }, 404)
    const { data: admins } = await admin.from('admins').select('user_id')
    const payload = { title: '🐞 Uygulamada yeni bir hata', body: e.message.slice(0, 180), url: '/?admin=errors', tag: `error-${body.client_error_id}` }
    return json({ sent: await sendToUsers((admins ?? []).map((a) => a.user_id), payload) })
  }
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
    return json({
      sent: await sendToUsers(others, (lang) => ({
        title: `${icon} ${say(lang, `${me?.name} dilek listesine ekledi`, `${me?.name} added to their wish list`)}`,
        body: wish.title,
        url: `/?tab=dilekler&wish=${wish.id}`,
        tag: `wish-${wish.id}`,
      })),
    })
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
    return json({
      sent: await sendToUsers([c.author], (lang) => ({
        title: `${reaction.emoji} ${me?.name} ${say(lang, ...words)}`,
        body: `“${commentText(c, lang).slice(0, 160)}”`,
        url,
        tag: `comment-reaction-${commentId}`,
      })),
    })
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
      const text = (lang: Lang) => commentText(c, lang).slice(0, 180)
      const tag = `share-chat-${c.event_id}-open`
      let sent = 0
      if (c.author !== c.owner) {
        const hidden = hiddenFrom(event!, c.owner)
        sent += await sendToUsers([c.owner], (lang) => ({
          title: hidden
            ? say(lang, `💬 ${me?.name}, bir planın hakkında yazdı`, `💬 ${me?.name} wrote about one of your plans`)
            : say(lang, `💬 ${me?.name}, “${event!.title}” planın hakkında yazdı`, `💬 ${me?.name} wrote about your plan “${event!.title}”`),
          body: text(lang),
          url: `/?event=${c.event_id}&about=open`,
          tag,
        }))
      }
      if (joined.length) {
        const ownerName = owner?.name ?? ''
        sent += await sendToUsers(joined, (lang) => ({
          title:
            c.author === c.owner
              ? say(lang, `💬 ${me?.name} cevap verdi · “${event!.title}”`, `💬 ${me?.name} replied · “${event!.title}”`)
              : say(
                  lang,
                  `💬 ${me?.name}, ${genitive(ownerName)} “${event!.title}” planı hakkında yazdı`,
                  `💬 ${me?.name} wrote about ${ownerName}’s plan “${event!.title}”`,
                ),
          body: text(lang),
          url: `/?shared=${c.owner}&event=${c.event_id}`,
          tag,
        }))
      }
      return json({ sent })
    }

    const toOwner = c.author === c.viewer
    const recipient = toOwner ? c.owner : c.viewer
    const { data: share } = await admin.from('calendar_shares').select('level').eq('owner', c.owner).eq('viewer', c.viewer).maybeSingle()
    // The owner knows their plan by name (unless it is a surprise for them); the viewer only if they see names.
    const hidden = hiddenFrom(event!, c.owner)
    const named = share?.level === 'details' && !event!.surprise
    const title = (lang: Lang) =>
      toOwner
        ? hidden
          ? say(lang, `💬 ${me?.name}, bir planın hakkında yazdı`, `💬 ${me?.name} wrote about one of your plans`)
          : say(lang, `💬 ${me?.name}, “${event!.title}” planın hakkında yazdı`, `💬 ${me?.name} wrote about your plan “${event!.title}”`)
        : named
          ? say(lang, `💬 ${me?.name} cevap verdi · “${event!.title}”`, `💬 ${me?.name} replied · “${event!.title}”`)
          : say(lang, `💬 ${me?.name} cevap verdi · takvimindeki plan`, `💬 ${me?.name} replied · a plan on their calendar`)
    return json({
      sent: await sendToUsers([recipient], (lang) => ({
        title: title(lang),
        body: commentText(c, lang).slice(0, 180),
        url: toOwner ? `/?event=${c.event_id}&about=${c.viewer}` : `/?shared=${c.owner}&event=${c.event_id}`,
        tag: `share-chat-${c.event_id}-${c.viewer}`,
      })),
    })
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
    return json({
      sent: await sendToUsers([body.share_viewer], (lang) => ({
        title: say(lang, `📅 ${me?.name} takvimini seninle paylaştı`, `📅 ${me?.name} shared their calendar with you`),
        body:
          share.level === 'details'
            ? say(
                lang,
                'Planlarının adlarını ve saatlerini görebilirsin; boş olduğu bir zamana plan önerebilirsin.',
                'You can see the names and times of their plans, and suggest a plan when they’re free.',
              )
            : say(
                lang,
                'Dolu olduğu saatleri görebilirsin; boş olduğu bir zamana plan önerebilirsin.',
                'You can see when they’re busy, and suggest a plan when they’re free.',
              ),
        url: `/?person=${userId}`,
        tag: `share-${userId}`,
      })),
    })
  }

  // "Test bildirimi gönder" in settings: only to my own devices.
  if (body.test) {
    return json({
      sent: await sendToUsers([userId], (lang) => ({
        title: say(lang, '🔔 Test bildirimi', '🔔 Test notification'),
        body: say(lang, 'Bildirimler bu cihazda çalışıyor 💜', 'Notifications work on this device 💜'),
        url: '/',
        tag: 'test',
      })),
    })
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
    return json({
      sent: await sendToUsers(others, (lang) => ({
        title: claim.shared
          ? say(lang, `🎁 ${me?.name} bunu alıyor`, `🎁 ${me?.name} is getting this`)
          : say(lang, '🔒 Biri bunu alıyor', '🔒 Someone is getting this'),
        body: say(
          lang,
          `${genitive(ownerName)} dileği: ${wish!.title} — ${ownerName} bilmiyor 🤫`,
          `${ownerName}’s wish: ${wish!.title} — ${ownerName} doesn’t know 🤫`,
        ),
        url: `/?tab=dilekler&wish=${wish!.id}`,
        tag: `claim-${wish!.id}`,
      })),
    })
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
  let comment: { body: string; image_path?: string | null } | null = null
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
    const when = (lang: Lang) => formatWhen(groupPlan, lang)
    const others = guests.filter((g) => g.id !== userId)
    const names = (list: Guest[]) => list.map((g) => g.name).join(', ')
    // Guests the plan is still a surprise for; they hear only the teaser, and nothing of the planning.
    const secretFor = new Set(others.filter((g) => hiddenFrom(groupPlan, g.id)).map((g) => g.id))
    const insiders = others.filter((g) => !secretFor.has(g.id))
    const targets = guests.filter((g) => secretFor.has(g.id))
    const forWhom = (lang: Lang) =>
      targets.length ? say(lang, ` · 🤫 ${names(targets)} için sürpriz`, ` · 🤫 a surprise for ${names(targets)}`) : ''
    if (hiddenFrom(groupPlan, userId) && !body.response_event_id) return json({ error: 'not_found' }, 404)
    let sent = 0

    if (body.event_id) {
      if (groupPlan.created_by !== userId) return json({ error: 'not_found' }, 404)
      const invited = insiders.filter((g) => g.status !== 'maker').map((g) => g.id)
      sent += await sendToUsers(
        invited,
        (lang) => ({
          title: say(lang, `👥 ${me.name} seni bir plana davet ediyor`, `👥 ${me.name} invited you to a plan`),
          body: say(
            lang,
            `${groupPlan.title} · ${when(lang)}${forWhom(lang)} — ${names(others)} davetli`,
            `${groupPlan.title} · ${when(lang)}${forWhom(lang)} — invited: ${names(others)}`,
          ),
          url,
          tag: groupPlan.id,
        }),
        groupPlan.id,
      )
      sent += await sendToUsers(
        [...secretFor],
        (lang) => ({
          title: say(lang, `🎁 ${me.name} seni bir sürpriz için ayırtmak istiyor`, `🎁 ${me.name} wants to book you for a surprise`),
          body: say(lang, `${when(lang)} boş musun? “${groupPlan.teaser}”`, `Are you free on ${when(lang)}? “${groupPlan.teaser}”`),
          url,
          tag: groupPlan.id,
        }),
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
      const suggestedWhen = (lang: Lang) =>
        answer?.suggested_date
          ? formatWhen({ ...groupPlan, event_date: answer.suggested_date, event_time: answer.suggested_time }, lang)
          : ''
      const answers: Record<string, (lang: Lang) => { title: string; body: string }> = {
        accepted: (lang) => ({
          title: say(lang, `✅ ${me.name} katılıyor`, `✅ ${me.name} is going`),
          body: `${groupPlan.title} · ${when(lang)}${note}`,
        }),
        maybe: (lang) => ({ title: say(lang, `🤔 ${me.name} belki katılır`, `🤔 ${me.name} might come`), body: `${groupPlan.title}${note}` }),
        suggested: (lang) => ({
          title: say(lang, `🕐 ${me.name} başka zaman öneriyor`, `🕐 ${me.name} suggests another time`),
          body: say(lang, `${suggestedWhen(lang)} olur mu?`, `How about ${suggestedWhen(lang)}?`) + ` · ${groupPlan.title}${note}`,
        }),
        declined: (lang) => ({ title: say(lang, `❌ ${me.name} katılamıyor`, `❌ ${me.name} can’t make it`), body: `${groupPlan.title}${note}` }),
      }
      const words = answers[me.status as string]
      if (!words) return json({ error: 'bad_answer' }, 400)
      // A suggested time is a question for the maker; other answers are news for everyone in on it.
      const to = me.status === 'suggested' ? insiders.filter((g) => g.status === 'maker') : insiders
      sent += await sendToUsers(to.map((g) => g.id), (lang) => ({ ...words(lang), url, tag }), groupPlan.id)
    } else if (body.moved_event_id) {
      // The maker moved the plan to a new time: everyone is asked again.
      if (groupPlan.created_by !== userId) return json({ error: 'not_found' }, 404)
      sent += await sendToUsers(
        insiders.map((g) => g.id),
        (lang) => ({
          title: say(lang, `🕐 ${me.name} planı yeni bir zamana taşıdı`, `🕐 ${me.name} moved the plan to a new time`),
          body: say(lang, `${groupPlan.title} · ${when(lang)} — gelebiliyor musun?`, `${groupPlan.title} · ${when(lang)} — can you make it?`),
          url,
          tag: `${groupPlan.id}-moved`,
        }),
        groupPlan.id,
      )
      sent += await sendToUsers(
        [...secretFor],
        (lang) => ({
          title: say(lang, `🎁 ${me.name} sürprizin zamanını değiştirdi`, `🎁 ${me.name} changed the time of your surprise`),
          body: say(lang, `${when(lang)} boş musun? “${groupPlan.teaser}”`, `Are you free on ${when(lang)}? “${groupPlan.teaser}”`),
          url,
          tag: `${groupPlan.id}-moved`,
        }),
        groupPlan.id,
      )
    } else {
      const said = comment
      sent += await sendToUsers(
        insiders.map((g) => g.id),
        (lang) =>
          said
            ? { title: `💬 ${me.name} · ${groupPlan.title}`, body: commentText(said, lang).slice(0, 180), url: `${url}&chat=1`, tag: `${groupPlan.id}-chat` }
            : {
                title: say(lang, `${body.emoji} ${me.name} planına tepki verdi`, `${body.emoji} ${me.name} reacted to the plan`),
                body: groupPlan.title,
                url,
                tag: `${groupPlan.id}-react`,
              },
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
  const when = (lang: Lang) => formatWhen(event, lang)
  let message: (lang: Lang) => { title: string; body: string; url: string; tag: string }

  if (body.event_id) {
    // A new plan or proposal: only its creator announces it.
    if (event.created_by !== userId) return json({ error: 'not_found' }, 404)
    const asking = event.status === 'proposed'
    message = (lang) =>
      event.surprise
        ? asking
          ? {
              title: say(lang, `🎁 ${me.name} seni bir sürpriz için ayırtmak istiyor`, `🎁 ${me.name} wants to book you for a surprise`),
              body: say(lang, `${when(lang)} uygun musun? “${event.teaser}”`, `Are you free on ${when(lang)}? “${event.teaser}”`),
              url,
              tag: event.id,
            }
          : {
              title: say(lang, `🎁 ${me.name} bir sürpriz hazırladı`, `🎁 ${me.name} has a surprise for you`),
              body: `“${event.teaser}” · ${when(lang)}`,
              url,
              tag: event.id,
            }
        : asking
          ? {
              title: say(lang, `📨 ${me.name} bir plan teklif ediyor`, `📨 ${me.name} suggests a plan`),
              body: say(lang, `${event.title} · ${when(lang)} — uygun musun?`, `${event.title} · ${when(lang)} — are you free?`),
              url,
              tag: event.id,
            }
          : {
              title: say(lang, `💌 ${me.name} yeni bir plan ekledi`, `💌 ${me.name} added a new plan`),
              body: `${event.title} · ${when(lang)}`,
              url,
              tag: event.id,
            }
  } else if (body.response_event_id) {
    // An answer to a proposal goes to whoever asked; the caller must have just answered it.
    if (event.status === 'proposed' && event.awaiting === userId) return json({ error: 'not_answered' }, 409)
    const note = event.response_note ? ` · “${event.response_note}”` : ''
    const tag = `${event.id}-answer`
    message = (lang) => {
      const plan = nameFor(event, partner.id, lang)
      return event.status === 'confirmed'
        ? { title: say(lang, `✅ ${me.name} uygun!`, `✅ ${me.name} is free!`), body: `${plan} · ${when(lang)}${note}`, url, tag }
        : event.status === 'declined'
          ? { title: say(lang, `❌ ${me.name} o zaman uygun değil`, `❌ ${me.name} isn’t free then`), body: `${plan}${note}`, url, tag }
          : { title: say(lang, `🕐 ${me.name} başka bir zaman önerdi`, `🕐 ${me.name} suggested another time`), body: `${plan} · ${when(lang)}${note}`, url, tag }
    }
  } else {
    // Talking about a still-hidden surprise must not reach the person it is hidden from.
    if (hiddenFrom(event, userId) || hiddenFrom(event, partner.id)) return json({ sent: 0 })
    const said = comment
    message = (lang) =>
      said
        ? { title: `💬 ${me.name} · ${event.title}`, body: commentText(said, lang).slice(0, 180), url: `${url}&chat=1`, tag: `${event.id}-chat` }
        : {
            title: say(lang, `${body.emoji} ${me.name} planına tepki verdi`, `${body.emoji} ${me.name} reacted to your plan`),
            body: event.title,
            url,
            tag: `${event.id}-react`,
          }
  }

  return json({ sent: await sendToUsers([partner.id], message, event.id) })
})
