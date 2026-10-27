// GIF search for comments, through KLIPY. The key stays here, and KLIPY never sees who searches:
// it gets a stand-in id per person, not their account or address.
//   { status: true }          is GIF search switched on?
//   { q?, page? }             search (or what is popular when q is empty)
//   { url }                   the chosen GIF itself, so the app can attach it like a photo
import { admin } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const KEY = Deno.env.get('KLIPY_API_KEY')
const BASE = 'https://api.klipy.com/api/v1'
const MAX_BYTES = 8 * 1024 * 1024

type Size = { gif?: { url?: string; width?: number; height?: number; size?: number } }
type Item = { id: string | number; title?: string; file?: Record<string, Size> }

// A stand-in id for KLIPY: the same for one person, telling nothing about them.
async function standIn(userId: string) {
  const bytes = new TextEncoder().encode(`usday-gif:${userId}`)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...hash.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// A small one for the grid, and one not too heavy to send.
function pick(item: Item) {
  const f = item.file ?? {}
  const preview = f.sm?.gif ?? f.xs?.gif ?? f.md?.gif ?? f.hd?.gif
  const send = [f.md?.gif, f.sm?.gif, f.hd?.gif].find((g) => g?.url && (g.size ?? 0) <= MAX_BYTES) ?? preview
  if (!preview?.url || !send?.url) return null
  return {
    id: String(item.id),
    title: item.title ?? '',
    preview: preview.url,
    url: send.url,
    width: preview.width ?? 1,
    height: preview.height ?? 1,
  }
}

const fromKlipy = (url: string) => {
  try {
    const host = new URL(url).hostname
    return url.startsWith('https://') && (host === 'klipy.com' || host.endsWith('.klipy.com') || host.endsWith('.klipy.co'))
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  if (body.status) return json({ configured: Boolean(KEY) })
  if (!KEY) return json({ error: 'not_configured' }, 503)

  // The chosen GIF, handed over as a file
  if (typeof body.url === 'string') {
    if (!fromKlipy(body.url)) return json({ error: 'bad_url' }, 400)
    const res = await fetch(body.url)
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (!res.ok || bytes.length > MAX_BYTES) return json({ error: 'unavailable' }, 502)
    return new Response(bytes, { headers: { ...cors, 'Content-Type': 'application/octet-stream' } })
  }

  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 80) : ''
  const page = Math.min(Math.max(Number(body.page) || 1, 1), 20)
  const params = new URLSearchParams({
    page: String(page),
    per_page: '24',
    customer_id: await standIn(userId),
    locale: 'tr',
    content_filter: 'medium',
  })
  if (q) params.set('q', q)
  const res = await fetch(`${BASE}/${KEY}/gifs/${q ? 'search' : 'trending'}?${params}`)
  if (!res.ok) {
    console.error('klipy', res.status, (await res.text()).slice(0, 200))
    return json({ error: 'unavailable' }, 502)
  }
  const data = await res.json()
  const items: Item[] = data?.data?.data ?? data?.data ?? data?.results ?? []
  return json({
    gifs: items.map(pick).filter(Boolean),
    more: Boolean(data?.data?.has_next ?? items.length === 24),
  })
})
