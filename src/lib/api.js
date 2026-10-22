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

const toPerson = (p) => ({ id: p.id, name: p.name, short: initials(p.name), color: p.color })

function fromRow(r, urlFor) {
  return {
    id: r.id,
    title: r.title,
    date: r.event_date,
    time: r.event_time?.slice(0, 5) ?? '',
    tag: r.tag,
    note: r.note ?? '',
    photos: r.photos.map((path) => ({ path, url: urlFor(path) })),
    surprise: r.surprise,
    teaser: r.teaser ?? '',
    revealOn: r.reveal_on ?? '',
    blurPhotos: r.blur_photos,
    createdBy: r.created_by,
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
    locked: true,
  }
}

export async function loadEverything() {
  const results = await Promise.all([
    supabase.from('couples').select('id, cover_path, invite_code').single(),
    supabase.from('profiles').select('id, name, color').order('created_at'),
    supabase.from('events').select('*'),
    supabase.rpc('surprise_teasers'),
  ])
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
  const [couple, profiles, rows, teasers] = results.map((r) => r.data)

  const urlFor = await signedUrls(
    [couple.cover_path, ...rows.flatMap((r) => r.photos), ...teasers.flatMap((t) => t.photos)].filter(Boolean),
  )

  return {
    couple: {
      id: couple.id,
      inviteCode: couple.invite_code,
      coverPath: couple.cover_path,
      coverUrl: couple.cover_path ? urlFor(couple.cover_path) : null,
    },
    members: Object.fromEntries(profiles.map((p) => [p.id, toPerson(p)])),
    events: [...rows.map((r) => fromRow(r, urlFor)), ...teasers.map((t) => fromTeaser(t, urlFor))],
  }
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
    tag: form.tag,
    note: form.note || null,
    photos,
    surprise: form.surprise,
    teaser: form.surprise ? form.teaser : null,
    reveal_on: form.surprise ? form.revealOn : null,
    blur_photos: form.blurPhotos,
  }

  const { data, error } = original
    ? await supabase.from('events').update(row).eq('id', original.id).select('id').single()
    : await supabase.from('events').insert(row).select('id').single()

  if (error) {
    await removePhotos(uploaded)
    throw error
  }
  if (original) await removePhotos(original.photos.map((p) => p.path).filter((p) => !photos.includes(p)))
  return data.id
}

export async function deleteEvent(event) {
  const { error } = await supabase.from('events').delete().eq('id', event.id)
  if (error) throw error
  await removePhotos(event.photos.map((p) => p.path))
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
