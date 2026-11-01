-- Free trial (3 days, set up as the stores' introductory offer). The store webhook marks a subscription that
-- is still in its trial, so the app can say when the first payment comes. A trial counts as subscribed:
-- the people it covers can use UsDay during the trial too.
alter table public.subscriptions add column trial boolean not null default false;

create or replace function public.my_billing() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'enabled', (select b.enabled or (b.test_enabled and public.is_test_person(auth.uid())) from billing_settings b),
    'max', (select max_covered from billing_settings),
    'subscribed', public.is_subscribed(auth.uid()),
    'subscription', (select json_build_object('status', s.status, 'product', s.product, 'store', s.store, 'expires_at', s.expires_at, 'trial', s.trial)
                     from subscriptions s where s.user_id = auth.uid()),
    'used', public.covered_count(auth.uid()),
    'connections', coalesce((
      select json_agg(json_build_object(
        'couple_id', m.couple_id,
        'open', public.connection_open(m.couple_id),
        'covered_by_me', exists (select 1 from covered_connections c where c.payer = auth.uid() and c.couple_id = m.couple_id),
        'other_pays', exists (
          select 1 from couple_members o where o.couple_id = m.couple_id and o.user_id <> auth.uid() and public.is_subscribed(o.user_id)
        )
      ))
      from couple_members m where m.user_id = auth.uid()
    ), '[]'::json)
  )
$$;
