// Ends a connection (and optionally blocks the other person): the shared plans, comments,
// templates and photos of that connection are deleted for both people.
import { admin } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function listFolder(folder: string) {
  const { data } = await admin.storage.from('photos').list(folder, { limit: 1000 })
  return (data ?? []).map((f) => `${folder}/${f.name}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const { couple_id: coupleId, block } = await req.json().catch(() => ({}))
  if (typeof coupleId !== 'string') return json({ error: 'bad_request' }, 400)

  const { data: removed, error } = await admin.rpc('remove_connection_data', {
    p_user: userId,
    p_couple: coupleId,
    p_block: block === true,
  })
  if (error) return json({ error: error.message }, error.message === 'not_member' ? 404 : 400)

  const files = (await Promise.all((removed as string[]).map(listFolder))).flat()
  if (files.length) await admin.storage.from('photos').remove(files)
  return json({ removed: (removed as string[]).length })
})
