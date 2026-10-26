// Permanently deletes the signed-in user: their plans, photos, wishes, templates and devices.
// In each connection the other person keeps their own plans; a connection left empty is removed.
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

  const { data: memberships } = await admin.from('couple_members').select('couple_id').eq('user_id', user.id)
  const files: string[] = await listFolder(user.id) // wish photos

  for (const { couple_id } of memberships ?? []) {
    const { count } = await admin.from('couple_members').select('user_id', { count: 'exact', head: true }).eq('couple_id', couple_id)
    if ((count ?? 0) <= 1) {
      files.push(...(await listFolder(couple_id)))
      await admin.from('couples').delete().eq('id', couple_id)
    } else {
      const { data: mine } = await admin.from('events').select('photos').eq('couple_id', couple_id).eq('created_by', user.id)
      files.push(...(mine ?? []).flatMap((e) => e.photos))
    }
  }
  // Group plans I made go away with me, and so do their photo folders.
  const { data: groups } = await admin.from('events').select('id').is('couple_id', null).eq('created_by', user.id)
  for (const { id } of groups ?? []) files.push(...(await listFolder(`g-${id}`)))

  if (files.length) await admin.storage.from('photos').remove(files)

  // Cascades to profile, memberships, own plans, wishes, templates, devices and calendar link.
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json({ error: error.message }, 500)
  return json({ deleted: true })
})
