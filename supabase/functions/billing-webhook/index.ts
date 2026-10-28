// RevenueCat tells us about purchases, renewals, cancellations and expiries here. The app user id in
// RevenueCat is the Supabase user id, so each event updates that person's row in `subscriptions`;
// the database then works out which connections are open.
import { admin } from '../_shared/push.ts'

const ACTIVE = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
])
const STATUS: Record<string, string> = { CANCELLATION: 'cancelled', BILLING_ISSUE: 'grace', EXPIRATION: 'expired' }
const STORES: Record<string, string> = { APP_STORE: 'app_store', MAC_APP_STORE: 'app_store', PLAY_STORE: 'play_store', PROMOTIONAL: 'promo' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  // RevenueCat sends the authorization value we set in its dashboard.
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) return reply({ error: 'unauthorized' }, 401)

  const { event } = await req.json().catch(() => ({ event: null }))
  if (!event?.type) return reply({ error: 'bad_request' }, 400)
  if (event.type === 'TEST') return reply({ ok: true })

  const userId = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].find((id) => UUID.test(id ?? ''))
  if (!userId) return reply({ ignored: 'no app user' })

  const status = ACTIVE.has(event.type) ? 'active' : STATUS[event.type]
  if (!status) return reply({ ignored: event.type })

  const ms = event.type === 'BILLING_ISSUE' ? (event.grace_period_expiration_at_ms ?? event.expiration_at_ms) : event.expiration_at_ms
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    status,
    product: /year|annual|yil/i.test(event.product_id ?? '') ? 'yearly' : 'monthly',
    store: STORES[event.store] ?? (event.store ? String(event.store).toLowerCase() : null),
    expires_at: ms ? new Date(ms).toISOString() : null,
    updated_at: new Date().toISOString(),
  })
  if (error) return reply({ error: error.message }, 500)
  return reply({ ok: true, user: userId, status })
})
