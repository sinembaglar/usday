// The App Store / Google Play review account: Deniz (demo@usday.app) with a partner, a sister and a friend,
// and a few weeks of plans around today. Safe to run again before each submission: it keeps the accounts and
// connections, removes what the four of them added and adds it again with fresh dates.
//
//   node --env-file=.env.local scripts/demo.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const PASS = process.env.DEMO_PASSWORD
if (!URL || !KEY || !PASS) throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and DEMO_PASSWORD are needed')

const must = ({ data, error }) => {
  if (error) throw error
  return data
}
const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function person(email, name, birthday) {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  let { data, error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) data = must(await c.auth.signUp({ email, password: PASS, options: { data: { name, birthday } } }))
  return { c, id: data.user.id, name }
}

const D = await person('demo@usday.app', 'Deniz', '2000-05-21')
const A = await person('demo-arda@usday.app', 'Arda', '2000-09-03')
const E = await person('demo-elif@usday.app', 'Elif', `2000-${day(17).slice(5)}`)
const M = await person('demo-mert@usday.app', 'Mert', '2000-01-28')

// One connection per person, reused when it is already there.
async function connect(other, relation) {
  const mine = must(await D.c.from('couple_members').select('couple_id').eq('user_id', D.id)).map((r) => r.couple_id)
  const shared = mine.length
    ? must(await D.c.from('couple_members').select('couple_id').eq('user_id', other.id).in('couple_id', mine))
    : []
  if (shared.length) return shared[0].couple_id
  const id = must(await D.c.rpc('create_connection', { p_relation: relation }))
  const { invite_code } = must(await D.c.from('couples').select('invite_code').eq('id', id).single())
  must(await other.c.rpc('join_couple', { code: invite_code }))
  return id
}
const DA = await connect(A, 'partner')
const DE = await connect(E, 'sibling')
const DM = await connect(M, 'friend')
must(await D.c.from('couples').update({ together_since: '2022-03-19' }).eq('id', DA))

// Start over: what the four of them added goes (comments, replies and claims go with it).
for (const p of [D, A, E, M]) {
  must(await p.c.from('events').delete().eq('created_by', p.id))
  must(await p.c.from('wishes').delete().eq('owner', p.id))
}

const plan = async (who, row) => must(await who.c.from('events').insert({ created_by: who.id, ...row }).select('id').single()).id

const cinema = await plan(A, { couple_id: DA, title: '🎬 Sinema', event_date: day(2), event_time: '21:15', end_time: '23:30', location: 'Kadıköy', tag: 'date' })
await plan(D, { couple_id: DA, title: '🍝 Akşam yemeği', event_date: day(6), event_time: '20:00', location: 'Karaköy', tag: 'date' })
await plan(D, { couple_id: DA, title: '✈️ Kapadokya', event_date: day(26), tag: 'tatil' })
// A surprise Deniz is preparing for Arda: Deniz sees everything.
await plan(D, { couple_id: DA, title: 'Yıldönümü sürprizi', event_date: day(12), event_time: '19:30', location: 'Bebek, sahil', tag: 'ozel', note: 'Masa ayırttım, pasta 19:00’da gelecek.', surprise: true, teaser: 'O akşamı boş tut, şık giyin 😉', reveal_on: day(12) })
// A surprise Arda is preparing for Deniz: Deniz only sees the teaser.
await plan(A, { couple_id: DA, title: 'Hafta sonu kaçamağı', event_date: day(9), event_time: '10:00', location: 'Şile', tag: 'ozel', surprise: true, teaser: 'Cumartesi sabahı erken kalk, küçük bir çanta hazırla 🧳', reveal_on: day(9) })
await plan(E, { couple_id: DE, title: '☕ Kahvaltı', event_date: day(3), event_time: '10:30', location: 'Moda', tag: 'plan' })
await plan(M, { couple_id: DM, title: '🎾 Tenis', event_date: day(1), event_time: '19:00', tag: 'plan', status: 'proposed', awaiting: D.id })

// A group plan with everyone's replies.
const party = await plan(D, { couple_id: null, title: '🎂 Elif’in doğum günü', event_date: day(17), event_time: '20:00', location: 'Cihangir', tag: 'ozel' })
must(await D.c.from('event_participants').insert([A, E, M].map((p) => ({ event_id: party, user_id: p.id }))))
must(await A.c.rpc('answer_invitation', { p_event: party, p_status: 'accepted', p_note: 'Pastayı ben alırım 🎂' }))
must(await E.c.rpc('answer_invitation', { p_event: party, p_status: 'accepted' }))
must(await M.c.rpc('answer_invitation', { p_event: party, p_status: 'maybe', p_note: 'İşten çıkabilirsem' }))

const first = must(await A.c.from('event_comments').insert({ event_id: cinema, body: 'Biletleri aldım, orta sıra 🍿' }).select('id').single()).id
must(await D.c.from('event_comments').insert({ event_id: cinema, body: 'Süpersin! Mısırı ben alırım' }))
must(await D.c.from('comment_reactions').insert({ comment_id: first, user_id: D.id, emoji: '😍' }))

const headphones = must(await A.c.from('wishes').insert({ category: 'gift', title: 'Kablosuz kulaklık', price: '3.500 TL', note: 'Siyah olsun', loved: true }).select('id').single()).id
must(await A.c.from('wishes').insert([{ category: 'experience', title: 'Seramik atölyesi', price: '1.200 TL' }, { category: 'gift', title: 'Kahve makinesi' }]))
must(await E.c.from('wishes').insert({ category: 'gift', title: 'Fotoğraf makinesi askısı' }))
must(await D.c.from('wishes').insert({ category: 'travel', title: 'Kapadokya balon turu', loved: true }))
must(await D.c.from('wish_claims').upsert({ wish_id: headphones }))

console.log('Demo hesabı hazır: demo@usday.app (şifre .env.local içinde DEMO_PASSWORD)')
process.exit(0)
