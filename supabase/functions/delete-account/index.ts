// Permanently deletes the signed-in user: their plans, photos, templates and devices.
// The partner keeps their own plans; a calendar left with nobody in it is removed entirely.
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
  const user = auth.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { data: me } = await admin.from('profiles').select('couple_id').eq('id', user.id).maybeSingle()
  if (me) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('couple_id', me.couple_id)
    const lastOne = (count ?? 0) <= 1

    const files = lastOne
      ? await listFolder(me.couple_id)
      : ((await admin.from('events').select('photos').eq('created_by', user.id)).data ?? []).flatMap((e) => e.photos)
    if (files.length) await admin.storage.from('photos').remove(files)

    if (lastOne) await admin.from('couples').delete().eq('id', me.couple_id)
  }

  // Cascades to profile, own plans, templates, push devices and calendar link.
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json({ error: error.message }, 500)
  return json({ deleted: true })
})
