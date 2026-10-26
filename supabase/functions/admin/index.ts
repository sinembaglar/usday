// Admin actions that need the auth server: banning someone and lifting a ban.
// A ban signs the person out everywhere within the hour, blocks new sign-ins and stops their
// notifications. Nothing of theirs is deleted, so a mistaken ban can be undone.
import { admin } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return json({ error: 'unauthorized' }, 401)
  const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (!isAdmin) return json({ error: 'forbidden' }, 403)

  const { action, user_id: target, reason } = await req.json().catch(() => ({}))
  if (!['ban', 'unban'].includes(action) || typeof target !== 'string') return json({ error: 'bad_request' }, 400)
  if (target === userId) return json({ error: 'cannot_ban_self' }, 400)

  const { error } = await admin.auth.admin.updateUserById(target, {
    ban_duration: action === 'ban' ? '876000h' : 'none',
  })
  if (error) return json({ error: error.message }, 500)

  if (action === 'ban') {
    await admin.from('push_subscriptions').delete().eq('user_id', target)
    await admin.from('reports').update({ status: 'closed' }).eq('reported', target).neq('status', 'closed')
  }
  await admin.from('moderation_log').insert({
    admin: userId,
    target,
    action,
    reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
  })
  return json({ ok: true })
})
