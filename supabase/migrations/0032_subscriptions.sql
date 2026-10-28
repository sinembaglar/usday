-- Subscriptions. A connection is open when one of its two people pays for it: a subscription covers
-- the subscriber and at most 5 connections (6 people, like family plans). A connection where the other
-- person pays too does not use a slot. When nobody pays, the connection becomes read-only: nothing is
-- deleted, but no new plans, invitations or comments can be added.
--
-- Everything is behind a switch: until billing is turned on, every connection is open. A test switch
-- turns it on only for connections made entirely of test accounts (@usday.test), so the rules can be
-- tried against the real database without touching real people.

create table public.billing_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  test_enabled boolean not null default false,
  max_covered integer not null default 5
);
insert into public.billing_settings default values;
alter table public.billing_settings enable row level security;
create policy "anyone signed in reads the billing switch" on public.billing_settings
  for select to authenticated using (true);

-- Written by the store webhook (RevenueCat), never by the app itself.
create table public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null check (status in ('active', 'cancelled', 'grace', 'expired')),
  product text, -- 'monthly' | 'yearly'
  store text, -- 'app_store' | 'play_store' | 'promo'
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "my subscription" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- Which connections a subscriber pays for (chosen by them; filled in automatically at first).
create table public.covered_connections (
  payer uuid not null references auth.users on delete cascade,
  couple_id uuid not null references public.couples on delete cascade,
  created_at timestamptz not null default now(),
  primary key (payer, couple_id)
);
alter table public.covered_connections enable row level security;

create function public.is_subscribed(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions s
    where s.user_id = person
      and s.status in ('active', 'cancelled', 'grace') -- cancelled still runs until it expires
      and (s.expires_at is null or s.expires_at > now())
  )
$$;

create function public.is_test_person(person uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u where u.id = person and u.email like '%@usday.test')
$$;

-- Do the payment rules apply to this connection?
create function public.billing_applies(p_couple uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select b.enabled or (
      b.test_enabled
      and not exists (
        select 1 from couple_members m where m.couple_id = p_couple and not public.is_test_person(m.user_id)
      )
    )
    from billing_settings b
  ), false)
$$;

-- Slots a subscriber is using: covered connections someone has joined, where the other person does not
-- pay themselves. An invitation nobody has accepted yet takes no slot.
create or replace function public.covered_count(person uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from covered_connections c
  where c.payer = person
    and (select count(*) from couple_members j where j.couple_id = c.couple_id) >= 2
    and not exists (
      select 1 from couple_members m
      where m.couple_id = c.couple_id and m.user_id <> person and public.is_subscribed(m.user_id)
    )
$$;

create or replace function public.connection_open(p_couple uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not public.billing_applies(p_couple)
    -- both pay: open, no slot needed
    or (select count(*) from couple_members m where m.couple_id = p_couple and public.is_subscribed(m.user_id)) >= 2
    -- a subscriber's invitation nobody has joined yet: open, and takes a slot only once someone joins
    or (
      (select count(*) from couple_members m where m.couple_id = p_couple) = 1
      and exists (select 1 from couple_members m where m.couple_id = p_couple and public.is_subscribed(m.user_id))
    )
    -- one pays and covers it
    or exists (
      select 1 from covered_connections c
      join couple_members m on m.couple_id = c.couple_id and m.user_id = c.payer
      where c.couple_id = p_couple and public.is_subscribed(c.payer)
    )
$$;

-- The connection between two people (for group plans), open or not.
create function public.people_open(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from couple_members x join couple_members y on y.couple_id = x.couple_id
    where x.user_id = a and y.user_id = b and public.connection_open(x.couple_id)
  )
$$;

revoke execute on function public.is_test_person(uuid) from public, anon, authenticated;
grant execute on function public.is_subscribed(uuid) to authenticated;
grant execute on function public.connection_open(uuid) to authenticated;
grant execute on function public.people_open(uuid, uuid) to authenticated;
grant execute on function public.billing_applies(uuid) to authenticated;
grant execute on function public.covered_count(uuid) to authenticated;

-- A subscriber covers the connections they choose, up to the limit.
create policy "see who pays for my connections" on public.covered_connections
  for select to authenticated using (payer = auth.uid() or public.is_member(couple_id));
create policy "cover my own connections" on public.covered_connections
  for insert to authenticated with check (payer = auth.uid() and public.is_member(couple_id));
create policy "stop covering" on public.covered_connections
  for delete to authenticated using (payer = auth.uid());

create function public.check_cover_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.covered_count(new.payer) >= (select max_covered from billing_settings) then
    raise exception 'no_slot';
  end if;
  return new;
end
$$;
create trigger covered_connections_limit before insert on public.covered_connections
  for each row execute function public.check_cover_limit();

-- A subscriber's connections are covered automatically, oldest first, while slots are free.
create or replace function public.auto_cover(person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  if not public.is_subscribed(person) then return; end if;
  for c in
    select m.couple_id from couple_members m join couples k on k.id = m.couple_id
    where m.user_id = person
      and (select count(*) from couple_members j where j.couple_id = m.couple_id) >= 2 -- someone has joined
      and not exists (select 1 from covered_connections x where x.payer = person and x.couple_id = m.couple_id)
      and not exists ( -- the other person pays for it already
        select 1 from couple_members o where o.couple_id = m.couple_id and o.user_id <> person and public.is_subscribed(o.user_id)
      )
    order by k.created_at
  loop
    exit when public.covered_count(person) >= (select max_covered from billing_settings);
    insert into covered_connections (payer, couple_id) values (person, c.couple_id) on conflict do nothing;
  end loop;
end
$$;
revoke execute on function public.auto_cover(uuid) from public, anon, authenticated;

-- A subscription starts or stops: the subscriber covers what they can, and the people they are
-- connected to take over (with their own free slots) the connections the subscriber no longer pays for.
create or replace function public.subscription_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  other record;
begin
  perform public.auto_cover(new.user_id);
  for other in
    select distinct o.user_id from couple_members m join couple_members o on o.couple_id = m.couple_id
    where m.user_id = new.user_id and o.user_id <> new.user_id
  loop
    perform public.auto_cover(other.user_id);
  end loop;
  return new;
end
$$;
create trigger subscriptions_cover after insert or update on public.subscriptions
  for each row execute function public.subscription_changed();

-- Someone joins a connection: whoever of the two pays covers it if they have a free slot.
create function public.member_joined_cover() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
begin
  for m in select user_id from couple_members where couple_id = new.couple_id loop
    perform public.auto_cover(m.user_id);
  end loop;
  return new;
end
$$;
create trigger couple_members_cover after insert on public.couple_members
  for each row execute function public.member_joined_cover();

-- Read-only when nobody pays: these add to the rules already in place (restrictive policies).
create policy "open connections only" on public.events as restrictive
  for insert to authenticated with check (couple_id is null or public.connection_open(couple_id));
create policy "open connections only (edit)" on public.events as restrictive
  for update to authenticated using (couple_id is null or public.connection_open(couple_id));
create policy "invite over open connections only" on public.event_participants as restrictive
  for insert to authenticated with check (
    public.people_open((select e.created_by from events e where e.id = event_id), user_id)
  );
create policy "comment in open connections only" on public.event_comments as restrictive
  for insert to authenticated with check (
    coalesce((select e.couple_id is null or public.connection_open(e.couple_id) from events e where e.id = event_id), true)
  );

-- Everything the app needs to show about paying, for me.
create function public.my_billing() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'enabled', (select b.enabled or (b.test_enabled and public.is_test_person(auth.uid())) from billing_settings b),
    'max', (select max_covered from billing_settings),
    'subscribed', public.is_subscribed(auth.uid()),
    'subscription', (select json_build_object('status', s.status, 'product', s.product, 'store', s.store, 'expires_at', s.expires_at)
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
grant execute on function public.my_billing() to authenticated;
