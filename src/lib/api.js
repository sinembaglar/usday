import { supabase } from './supabase'
import { initials } from './constants'

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
    createdBy: t.created_by,
    createdAt: t.created_at,
    locked: true,
  }
}

export async function loadEverything() {
  const results = await Promise.all([
    supabase.from('couples').select('id, cover_path, invite_code, together_since').single(),
    supabase.from('profiles').select('id, name, color, last_seen_at').order('created_at'),
    supabase.from('events').select('*'),
    supabase.rpc('surprise_teasers'),
    supabase.from('custom_templates').select('id, tag, title, event_time').order('created_at'),
    supabase.from('event_comments').select('event_id'),
  ])
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
  const [couple, profiles, rows, teasers, templates, comments] = results.map((r) => r.data)

  const commentCounts = {}
  for (const c of comments) commentCounts[c.event_id] = (commentCounts[c.event_id] ?? 0) + 1

  const urlFor = await signedUrls(
    [couple.cover_path, ...rows.flatMap((r) => r.photos), ...teasers.flatMap((t) => t.photos)].filter(Boolean),
  )

  return {
    couple: {
      id: couple.id,
      inviteCode: couple.invite_code,
      coverPath: couple.cover_path,
      coverUrl: couple.cover_path ? urlFor(couple.cover_path) : null,
      togetherSince: couple.together_since ?? '',
    },
    members: Object.fromEntries(profiles.map((p) => [p.id, toPerson(p)])),
    events: [...rows.map((r) => fromRow(r, urlFor)), ...teasers.map((t) => fromTeaser(t, urlFor))].map((e) => ({
      ...e,
      commentCount: commentCounts[e.id] ?? 0,
    })),
    templates: templates.map((t) => ({ id: t.id, tag: t.tag, title: t.title, time: t.event_time?.slice(0, 5) ?? '' })),
  }
}

export async function addTemplate({ tag, title, time }) {
  const { error } = await supabase.from('custom_templates').insert({ tag, title, event_time: time || null })
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

export async function saveEvent(form, coupleId, original) {
  const photos = await Promise.all(form.photos.map((p) => (p.dataUrl ? uploadPhoto(coupleId, p.dataUrl) : p.path)))
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
  }

  const { data, error } = original
    ? await supabase.from('events').update(row).eq('id', original.seriesId ?? original.id).select('id').single()
    : await supabase.from('events').insert(row).select('id').single()

  if (error) {
    await removePhotos(uploaded)
    throw error
  }
  if (original) await removePhotos(original.photos.map((p) => p.path).filter((p) => !photos.includes(p)))
  return data.id
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

export async function setTogetherSince(coupleId, date) {
  const { error } = await supabase.from('couples').update({ together_since: date || null }).eq('id', coupleId)
  if (error) throw error
}

export async function loadConversation(eventId) {
  const [comments, reactions] = await Promise.all([
    supabase.from('event_comments').select('id, author, body, created_at').eq('event_id', eventId).order('created_at'),
    supabase.from('event_reactions').select('user_id, emoji').eq('event_id', eventId),
  ])
  if (comments.error) throw comments.error
  if (reactions.error) throw reactions.error
  return { comments: comments.data, reactions: reactions.data }
}

export async function addComment(eventId, body) {
  const { data, error } = await supabase.from('event_comments').insert({ event_id: eventId, body }).select('id').single()
  if (error) throw error
  return data.id
}

export async function deleteComment(id) {
  const { error } = await supabase.from('event_comments').delete().eq('id', id)
  if (error) throw error
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

export async function joinCouple(code) {
  const { error } = await supabase.rpc('join_couple', { code })
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
