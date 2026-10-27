import { supabase } from './supabase'
import { initials } from './constants'
import { resizeImage } from './image'

const BUCKET = 'photos'
const URL_TTL = 60 * 60 * 24
const urlCache = new Map() // path -> { url, expires }

async function signedUrls(paths) {
  const now = Date.now()
  const missing = [...new Set(paths)].filter((p) => !(urlCache.get(p)?.expires > now + 60_000))
  if (missing.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, URL_TTL)
    if (error) throw error
    for (const item of data) {
      if (item.signedUrl) urlCache.set(item.path, { url: item.signedUrl, expires: now + URL_TTL * 1000 })
    }
  }
  return (path) => urlCache.get(path)?.url ?? null
}

const toPerson = (p) => ({
  id: p.id,
  name: p.name,
  short: initials(p.name),
  color: p.color,
  lastSeenAt: p.last_seen_at,
})

function fromRow(r, urlFor) {
  return {
    id: r.id,
    title: r.title,
    date: r.event_date,
    time: r.event_time?.slice(0, 5) ?? '',
    endTime: r.end_time?.slice(0, 5) ?? '',
    location: r.location ?? '',
    repeat: r.repeat,
    repeatUntil: r.repeat_until ?? '',
    skipDates: r.skip_dates ?? [],
    tag: r.tag,
    note: r.note ?? '',
    photos: r.photos.map((path) => ({ path, url: urlFor(path) })),
    surprise: r.surprise,
    teaser: r.teaser ?? '',
    revealOn: r.reveal_on ?? '',
    blurPhotos: r.blur_photos,
    status: r.status,
    awaiting: r.awaiting,
    responseNote: r.response_note ?? '',
    hiddenFrom: r.hidden_from ?? [],
    createdBy: r.created_by,
    createdAt: r.created_at,
    locked: false,
  }
}

// A surprise the partner prepared: only the teaser and the day are known.
function fromTeaser(t, urlFor) {
  const blurred = t.photos.length === 0 && t.photo_count > 0
  return {
    id: t.id,
    title: '',
    date: t.event_date,
    time: t.event_time?.slice(0, 5) ?? '',
    endTime: '',
    location: '',
    repeat: 'none',
    tag: 'date',
    note: '',
    photos: blurred
      ? Array.from({ length: t.photo_count }, (_, i) => ({ path: `locked-${i}`, url: null }))
      : t.photos.map((path) => ({ path, url: urlFor(path) })),
    surprise: true,
    teaser: t.teaser ?? '',
    revealOn: t.reveal_on,
    blurPhotos: blurred,
    status: t.status,
    awaiting: t.awaiting,
    responseNote: t.response_note ?? '',
    createdBy: t.created_by,
    createdAt: t.created_at,
    locked: true,
  }
}

// Everything the signed-in person can see, across all their connections.
export async function loadEverything(userId) {
  const results = await Promise.all([
    supabase.from('couples').select('id, cover_path, invite_code, together_since, relation, created_by, created_at').order('created_at'),
    supabase.from('profiles').select('id, name, color, last_seen_at').order('created_at'),
    supabase.from('events').select('*'),
    supabase.rpc('surprise_teasers'),
    supabase.from('custom_templates').select('id, couple_id, tag, title, event_time').order('created_at'),
    supabase.from('event_comments').select('event_id'),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    supabase.from('wishes').select('*').order('created_at', { ascending: false }),
    supabase.rpc('visible_claims'),
    supabase.from('couple_members').select('couple_id, user_id'),
    supabase.rpc('surprise_teaser_connections'),
    supabase.from('event_participants').select('event_id, user_id, status, note, suggested_date, suggested_time'),
    supabase.rpc('shared_calendar'),
    supabase.from('calendar_shares').select('owner, viewer, level'),
  ])
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
  const [
    couples,
    profiles,
    rows,
    teasers,
    templates,
    comments,
    ,
    wishRows,
    claims,
    memberRows,
    teaserCouples,
    guestRows,
    sharedRows,
    shareRows,
  ] = results.map((r) => r.data)
  // Group plans: who is invited and what they answered.
  const guestsOf = (eventId) =>
    guestRows
      .filter((g) => g.event_id === eventId)
      .map((g) => ({
        id: g.user_id,
        status: g.status,
        note: g.note ?? '',
        // "Başka zaman öner": the date and time this guest would rather have.
        suggested: g.suggested_date ? { date: g.suggested_date, time: g.suggested_time?.slice(0, 5) ?? '' } : null,
      }))
  const unreadNotifications = results[6].count ?? 0
  // Who is getting which of the others' wishes (never loaded for my own wishes).
  const claimOf = Object.fromEntries(
    claims.map((c) => [
      c.wish_id,
      // by and byName are null when the claimer keeps their name hidden ("biri alıyor").
      { by: c.claimed_by, byName: c.claimer_name, mine: c.claimed_by === userId, hasPlan: c.has_plan, shared: c.shared },
    ]),
  )
  const teaserCouple = Object.fromEntries(teaserCouples.map((t) => [t.id, t.couple_id]))

  const commentCounts = {}
  for (const c of comments) commentCounts[c.event_id] = (commentCounts[c.event_id] ?? 0) + 1

  const urlFor = await signedUrls(
    [
      ...couples.map((c) => c.cover_path),
      ...rows.flatMap((r) => r.photos),
      ...teasers.flatMap((t) => t.photos),
      ...wishRows.map((w) => w.photo_path),
    ].filter(Boolean),
  )

  return {
    // One entry per connection; partnerId is null while the invitation is still open.
    connections: couples.map((c) => ({
      id: c.id,
      inviteCode: c.invite_code,
      coverPath: c.cover_path,
      coverUrl: c.cover_path ? urlFor(c.cover_path) : null,
      togetherSince: c.together_since ?? '',
      relation: c.relation,
      createdBy: c.created_by,
      partnerId: memberRows.find((m) => m.couple_id === c.id && m.user_id !== userId)?.user_id ?? null,
    })),
    members: Object.fromEntries(profiles.map((p) => [p.id, toPerson(p)])),
    events: [
      ...rows.map((r) => ({
        ...fromRow(r, urlFor),
        coupleId: r.couple_id,
        guests: r.couple_id ? null : guestsOf(r.id),
      })),
      ...teasers.map((t) => ({
        ...fromTeaser(t, urlFor),
        coupleId: teaserCouple[t.id] ?? null,
        // A group surprise for me: I only know my own invitation, not who else is in on it.
        guests: teaserCouple[t.id] ? null : [{ id: userId, status: t.my_answer ?? 'pending', note: '' }],
      })),
    ].map((e) => ({
      ...e,
      commentCount: commentCounts[e.id] ?? 0,
    })),
    templates: templates.map((t) => ({
      id: t.id,
      coupleId: t.couple_id,
      tag: t.tag,
      title: t.title,
      time: t.event_time?.slice(0, 5) ?? '',
    })),
    unreadNotifications,
    // Plans on calendars others shared with me that I do not already see myself:
    // busy time, with the plan's name only when they share details (never for a surprise).
    sharedPlans: sharedRows
      .filter((s) => !rows.some((r) => r.id === s.id) && !teasers.some((t) => t.id === s.id))
      .map((s) => ({
        id: `shared-${s.owner}-${s.id}`,
        eventId: s.id, // the plan itself, for talking about it with its owner
        shared: true,
        owner: s.owner,
        createdBy: s.owner,
        coupleId: null,
        guests: null,
        title: s.title ?? 'Dolu',
        busy: !s.title,
        tag: s.tag ?? 'plan',
        date: s.event_date,
        time: s.event_time?.slice(0, 5) ?? '',
        endTime: s.end_time?.slice(0, 5) ?? '',
        repeat: s.repeat,
        repeatUntil: s.repeat_until ?? '',
        skipDates: s.skip_dates ?? [],
        status: s.status,
        photos: [],
      })),
    // Who I share my calendar with, and who shares theirs with me.
    sharesByMe: Object.fromEntries(shareRows.filter((s) => s.owner === userId).map((s) => [s.viewer, s.level])),
    sharesWithMe: Object.fromEntries(shareRows.filter((s) => s.viewer === userId).map((s) => [s.owner, s.level])),
    wishes: wishRows.map((w) => ({
      id: w.id,
      owner: w.owner,
      category: w.category,
      title: w.title,
      link: w.link ?? '',
      price: w.price ?? '',
      note: w.note ?? '',
      photo: w.photo_path ? { path: w.photo_path, url: urlFor(w.photo_path) } : null,
      loved: w.loved,
      status: w.status,
      doneAt: w.done_at,
      createdAt: w.created_at,
      claim: claimOf[w.id] ?? null, // only ever set on others' wishes
    })),
  }
}

// Wish photos live in the owner's own folder, visible to everyone they are connected with.
export async function saveWish(form, userId, original) {
  const newPhoto = form.photo?.dataUrl ? await uploadPhoto(userId, form.photo.dataUrl) : null
  const row = {
    category: form.category,
    title: form.title.trim(),
    link: form.link.trim() || null,
    price: form.price.trim() || null,
    note: form.note.trim() || null,
    photo_path: newPhoto ?? form.photo?.path ?? null,
    loved: form.loved,
  }
  const { data, error } = original
    ? await supabase.from('wishes').update(row).eq('id', original.id).select('id').single()
    : await supabase.from('wishes').insert(row).select('id').single()
  if (error) {
    if (newPhoto) await removePhotos([newPhoto])
    throw error
  }
  const oldPhoto = original?.photo?.path
  if (oldPhoto && oldPhoto !== row.photo_path) await removePhotos([oldPhoto])
  return data.id
}

export async function deleteWish(wish) {
  const { error } = await supabase.from('wishes').delete().eq('id', wish.id)
  if (error) throw error
  if (wish.photo) await removePhotos([wish.photo.path])
}

// "Bunu ben alıyorum": secret from the wish owner, shown to everyone else who can see the wish.
// planId links the surprise made from it.
export async function claimWish(wishId, planId = null, announce = true, shared = undefined) {
  const row = { wish_id: wishId, plan_id: planId, ...(shared === undefined ? {} : { shared }) }
  const { error } = await supabase.from('wish_claims').upsert(row)
  // Someone else claimed it a moment ago: their row is not mine to update.
  if (error) throw ['42501', '23505'].includes(error.code) ? new Error('taken') : error
  if (announce) supabase.functions.invoke('notify', { body: { claim_wish_id: wishId } }).catch(() => {})
}

// Show my name to the others ("Yaren alıyor") or only "biri alıyor". The owner never sees either.
export async function setClaimShared(wishId, shared) {
  const { error } = await supabase.from('wish_claims').update({ shared }).eq('wish_id', wishId)
  if (error) throw error
  if (shared) supabase.functions.invoke('notify', { body: { claim_wish_id: wishId } }).catch(() => {})
}

export async function unclaimWish(wishId) {
  const { error } = await supabase.from('wish_claims').delete().eq('wish_id', wishId)
  if (error) throw error
}

export async function completeWish(wishId) {
  const { error } = await supabase.rpc('complete_wish', { p_wish: wishId })
  if (error) throw error
}

export const NOTIFICATION_PAGE = 30

// Newest first; pass the oldest shown created_at to get the page before it.
export async function loadNotifications(before = null) {
  let query = supabase
    .from('notifications')
    .select('id, event_id, title, body, url, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(NOTIFICATION_PAGE)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function markNotificationsRead() {
  await supabase.rpc('mark_notifications_read')
}

export async function clearNotifications() {
  const { error } = await supabase.from('notifications').delete().not('id', 'is', null)
  if (error) throw error
}

export async function addTemplate({ coupleId, tag, title, time }) {
  const { error } = await supabase
    .from('custom_templates')
    .insert({ couple_id: coupleId, tag, title, event_time: time || null })
  if (error) throw error
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('custom_templates').delete().eq('id', id)
  if (error) throw error
}

async function uploadPhoto(coupleId, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${coupleId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

async function removePhotos(paths) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

// form.propose = ask the partner first; the plan waits for their answer.
// A group plan has coupleId null and group = { guestIds }. Its id is chosen here so its photos
// can go into its own private folder ("g-<id>") before the row exists.
export async function saveEvent(form, coupleId, original, partnerId, group = null) {
  const planId = group ? (original?.seriesId ?? original?.id ?? crypto.randomUUID()) : null
  const folder = coupleId ?? `g-${planId}`
  const photos = await Promise.all(form.photos.map((p) => (p.dataUrl ? uploadPhoto(folder, p.dataUrl) : p.path)))
  const uploaded = photos.filter((path, i) => form.photos[i].dataUrl)

  const row = {
    title: form.title,
    event_date: form.date,
    event_time: form.time || null,
    end_time: (form.time && form.endTime) || null,
    location: form.location?.trim() || null,
    repeat: form.surprise ? 'none' : form.repeat,
    repeat_until: !form.surprise && form.repeat !== 'none' ? form.repeatUntil || null : null,
    tag: form.tag,
    note: form.note || null,
    photos,
    surprise: form.surprise,
    teaser: form.surprise ? form.teaser : null,
    reveal_on: form.surprise ? form.revealOn : null,
    blur_photos: form.blurPhotos,
    ...(form.propose && partnerId
      ? { status: 'proposed', awaiting: partnerId, response_note: null }
      : { status: 'confirmed', awaiting: null }),
    // A group plan is a surprise only for the guests picked in "kimden gizli".
    ...(group
      ? group.hiddenFrom?.length && form.surprise
        ? { hidden_from: group.hiddenFrom }
        : { surprise: false, teaser: null, reveal_on: null, blur_photos: false, hidden_from: null }
      : { hidden_from: null }),
  }

  const { data, error } = original
    ? await supabase.from('events').update(row).eq('id', original.seriesId ?? original.id).select('id').single()
    : await supabase
        .from('events')
        .insert({ ...row, couple_id: coupleId, ...(planId ? { id: planId } : {}) })
        .select('id')
        .single()

  if (error) {
    await removePhotos(uploaded)
    throw error
  }
  if (original) await removePhotos(original.photos.map((p) => p.path).filter((p) => !photos.includes(p)))
  if (group) await syncGuests(data.id, group.guestIds, original?.guests ?? [])
  return data.id
}

// Invite the newly picked people and drop the ones no longer picked; answers already given stay.
async function syncGuests(eventId, guestIds, current) {
  const have = current.map((g) => g.id)
  const add = guestIds.filter((id) => !have.includes(id))
  const drop = have.filter((id) => !guestIds.includes(id))
  if (add.length) {
    const { error } = await supabase.from('event_participants').insert(add.map((user_id) => ({ event_id: eventId, user_id })))
    if (error) throw error
  }
  if (drop.length) {
    const { error } = await supabase.from('event_participants').delete().eq('event_id', eventId).in('user_id', drop)
    if (error) throw error
  }
}

// "Katılıyorum" / "Katılamıyorum" on a group plan I am invited to.
// status: 'accepted' | 'maybe' | 'suggested' (with date and time) | 'declined'
export async function answerInvitation(eventId, status, note = null, suggested = null) {
  const { error } = await supabase.rpc('answer_invitation', {
    p_event: eventId,
    p_status: status,
    p_note: note,
    p_date: suggested?.date ?? null,
    p_time: suggested?.time || null,
  })
  if (error) throw error
}

// The maker moves a group plan to a new time (e.g. a guest's suggestion); everyone is asked again.
export async function moveGroupPlan(eventId, date, time, fromGuest = null) {
  const { error } = await supabase.rpc('move_group_plan', {
    p_event: eventId,
    p_date: date,
    p_time: time || null,
    p_from: fromGuest,
  })
  if (error) throw error
  supabase.functions.invoke('notify', { body: { moved_event_id: eventId } }).catch(() => {})
}

export async function deleteEvent(event) {
  const { error } = await supabase.from('events').delete().eq('id', event.seriesId ?? event.id)
  if (error) throw error
  await removePhotos(event.photos.map((p) => p.path))
}

// Drops a single day from a repeating plan ("no gym this Monday").
export async function skipOccurrence(event) {
  const { error } = await supabase
    .from('events')
    .update({ skip_dates: [...(event.skipDates ?? []), event.date] })
    .eq('id', event.seriesId)
  if (error) throw error
}

// answer: 'accept' | 'decline' | 'counter' (counter needs a new date, time optional)
export async function respondToPlan(eventId, answer, { date = null, time = null, note = null } = {}) {
  const { error } = await supabase.rpc('respond_to_plan', {
    p_event: eventId,
    p_answer: answer,
    p_date: date,
    p_time: time || null,
    p_note: note,
  })
  if (error) throw error
}

export async function setTogetherSince(coupleId, date) {
  const { error } = await supabase.from('couples').update({ together_since: date || null }).eq('id', coupleId)
  if (error) throw error
}

// Comments with a picture get a short-lived link to it.
async function withImageUrls(comments) {
  const urlFor = await signedUrls(comments.map((c) => c.image_path).filter(Boolean))
  return comments.map((c) => ({ ...c, imageUrl: c.image_path ? urlFor(c.image_path) : null }))
}

export async function loadConversation(eventId) {
  const [comments, reactions] = await Promise.all([
    supabase.from('event_comments').select('id, author, body, image_path, created_at').eq('event_id', eventId).order('created_at'),
    supabase.from('event_reactions').select('user_id, emoji').eq('event_id', eventId),
  ])
  if (comments.error) throw comments.error
  if (reactions.error) throw reactions.error
  return { comments: await withImageUrls(comments.data), reactions: reactions.data }
}

const MAX_GIF = 8 * 1024 * 1024

// A picture for a comment: photos are made smaller; a GIF stays as it is so it keeps moving.
export async function uploadCommentImage(folder, file) {
  const gif = file.type === 'image/gif'
  if (gif && file.size > MAX_GIF) throw new Error('too_big')
  const blob = gif ? file : await (await fetch(await resizeImage(file, 1600))).blob()
  const path = `${folder}/${crypto.randomUUID()}.${gif ? 'gif' : 'jpg'}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: gif ? 'image/gif' : 'image/jpeg' })
  if (error) throw error
  return path
}

export async function addComment(eventId, body, imagePath = null) {
  const { data, error } = await supabase
    .from('event_comments')
    .insert({ event_id: eventId, body: body.trim(), image_path: imagePath })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function deleteComment(comment) {
  const { error } = await supabase.from('event_comments').delete().eq('id', comment.id)
  if (error) throw error
  if (comment.image_path) await supabase.storage.from(BUCKET).remove([comment.image_path])
}

// emoji = null removes my reaction.
export async function setReaction(eventId, userId, emoji) {
  const { error } = emoji
    ? await supabase.from('event_reactions').upsert({ event_id: eventId, user_id: userId, emoji })
    : await supabase.from('event_reactions').delete().eq('event_id', eventId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account')
  if (error) throw error
  await supabase.auth.signOut({ scope: 'local' })
}

export async function markSeen() {
  await supabase.rpc('mark_seen')
}

// Personal calendar feed token; renew=true invalidates the old link.
export async function calendarToken(renew = false) {
  const { data, error } = await supabase.rpc('my_calendar_token', { renew })
  if (error) throw error
  return data
}

// Returns the inviting partner's name, or null if the code is not usable.
export async function checkInvite(code) {
  const { data, error } = await supabase.rpc('check_invite', { code })
  if (error) throw error
  return data
}

// Joins someone's connection with their code; returns that connection's id.
export async function joinCouple(code) {
  const { data, error } = await supabase.rpc('join_couple', { code })
  if (error) throw error
  return data
}

// A new connection to invite someone into: partner, friend, sibling or family.
export async function createConnection(relation) {
  const { data, error } = await supabase.rpc('create_connection', { p_relation: relation })
  if (error) throw error
  return data
}

// Withdraws an invitation nobody has accepted yet.
export async function cancelConnection(coupleId) {
  const { error } = await supabase.rpc('cancel_connection', { p_couple: coupleId })
  if (error) throw error
}

export async function setRelation(coupleId, relation) {
  const { error } = await supabase.from('couples').update({ relation }).eq('id', coupleId)
  if (error) throw error
}

export async function setCover(couple, dataUrl) {
  const path = await uploadPhoto(couple.id, dataUrl)
  const { error } = await supabase.from('couples').update({ cover_path: path }).eq('id', couple.id)
  if (error) {
    await removePhotos([path])
    throw error
  }
  if (couple.coverPath) await removePhotos([couple.coverPath])
}

// Feedback, reports and the admin panel -------------------------------------------

const device = () =>
  [
    /iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'Web',
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone ? 'ana ekran' : 'tarayıcı',
    navigator.userAgent,
  ]
    .join(' · ')
    .slice(0, 300)

export async function sendFeedback(userId, kind, message) {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('feedback').insert({ id, author: userId, kind, message: message.trim(), device: device() })
  if (error) throw error
  supabase.functions.invoke('notify', { body: { feedback_id: id } }).catch(() => {})
}

export async function reportPerson(userId, reported, reason, message) {
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('reports')
    .insert({ id, reporter: userId, reported, reason, message: message.trim() || null })
  if (error) throw error
  supabase.functions.invoke('notify', { body: { report_id: id } }).catch(() => {})
}

export async function isAdmin() {
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

export const adminOverview = () => rpc('admin_overview')
export const adminUsers = (search) => rpc('admin_users', { search: search || null })
export const adminFeedback = () => rpc('admin_feedback')
export const adminReports = () => rpc('admin_reports')

export async function setStatus(table, id, status) {
  const { error } = await supabase.from(table).update({ status }).eq('id', id)
  if (error) throw error
}

export async function setBanned(userId, banned, reason = null) {
  const { error } = await supabase.functions.invoke('admin', {
    body: { action: banned ? 'ban' : 'unban', user_id: userId, reason },
  })
  if (error) throw error
}

// Share my calendar with someone I am connected with: 'busy', 'details', or null to stop.
export async function setCalendarShare(userId, viewer, level, announce = false) {
  const { error } = level
    ? await supabase.from('calendar_shares').upsert({ owner: userId, viewer, level })
    : await supabase.from('calendar_shares').delete().eq('owner', userId).eq('viewer', viewer)
  if (error) throw error
  if (level && announce) supabase.functions.invoke('notify', { body: { share_viewer: viewer } }).catch(() => {})
}

// Side conversations about plans on a shared calendar (between its owner and one viewer).
export async function loadShareComments(eventId) {
  const { data, error } = await supabase
    .from('share_comments')
    .select('id, owner, viewer, author, author_name, body, image_path, open, created_at')
    .eq('event_id', eventId)
    .order('created_at')
  if (error) throw error
  return withImageUrls(data)
}

export async function addShareComment({ eventId, owner, viewer, author, body, imagePath = null }) {
  const { error } = await supabase
    .from('share_comments')
    .insert({ event_id: eventId, owner, viewer, author, body: body.trim(), image_path: imagePath })
  if (error) throw error
}

export async function deleteShareComment(comment) {
  const { error } = await supabase.from('share_comments').delete().eq('id', comment.id)
  if (error) throw error
  if (comment.image_path) await supabase.storage.from(BUCKET).remove([comment.image_path])
}

// Ending a connection: its shared plans and photos are deleted for both; blocking also stops new invites.
export async function removeConnection(coupleId, block) {
  const { error } = await supabase.functions.invoke('remove-connection', { body: { couple_id: coupleId, block } })
  if (error) throw error
}

export async function loadBlocks() {
  const { data, error } = await supabase.from('blocks').select('blocked, blocked_name, created_at').order('created_at')
  if (error) throw error
  return data
}

export async function unblock(userId, blocked) {
  const { error } = await supabase.from('blocks').delete().eq('blocker', userId).eq('blocked', blocked)
  if (error) throw error
}

// Does this person (me or someone I am connected with) get phone notifications?
export async function hasPush(userId) {
  const { data, error } = await supabase.rpc('has_push', { person: userId })
  if (error) throw error
  return data
}
