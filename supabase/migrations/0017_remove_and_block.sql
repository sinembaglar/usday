-- Ending a connection, and blocking someone so they cannot connect again.
-- Removing a connection deletes what was shared in it (its plans, comments, templates and photos)
-- for both people. Blocking also takes them off each other's group plans and stops new invites.

create table public.blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  blocked_name text not null, -- they are no longer connected, so their profile is not readable
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;

create policy "my blocks" on public.blocks
  for select to authenticated using (blocker = auth.uid());
create policy "unblock" on public.blocks
  for delete to authenticated using (blocker = auth.uid());

-- Has either of us blocked the other?
create function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  )
$$;

-- An invite from someone in a block with me looks like an invalid code (it does not say why).
create or replace function public.check_invite(code text) returns text
language sql stable security definer set search_path = public as $$
  select p.name from couple_members m join profiles p on p.id = m.user_id
  where m.couple_id = public.open_couple(code)
    and not public.blocked_between(auth.uid(), m.user_id)
  limit 1
$$;

create or replace function public.join_couple(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target uuid := public.open_couple(code);
  inviter uuid;
begin
  if target is null or public.is_member(target) then
    raise exception 'invalid_invite';
  end if;
  select user_id into inviter from couple_members where couple_id = target limit 1;
  if public.blocked_between(auth.uid(), inviter) then
    raise exception 'invalid_invite';
  end if;
  if public.connected(inviter) then
    raise exception 'already_connected';
  end if;
  insert into couple_members (couple_id, user_id) values (target, auth.uid());
  return target;
end
$$;

-- The data part of removing a connection; the remove-connection function deletes the photos.
-- Runs for p_user (checked by the caller). Returns the removed connection ids.
create function public.remove_connection_data(p_user uuid, p_couple uuid, p_block boolean)
returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  other_name text;
  removed uuid[];
begin
  if not exists (select 1 from couple_members where couple_id = p_couple and user_id = p_user) then
    raise exception 'not_member';
  end if;
  select m.user_id, p.name into other, other_name
  from couple_members m join profiles p on p.id = m.user_id
  where m.couple_id = p_couple and m.user_id <> p_user;
  if other is null then
    raise exception 'not_joined'; -- an open invitation is cancelled with cancel_connection
  end if;

  if p_block then
    insert into blocks (blocker, blocked, blocked_name) values (p_user, other, other_name)
    on conflict (blocker, blocked) do update set blocked_name = excluded.blocked_name, created_at = now();
    -- Every connection between us goes.
    select array_agg(a.couple_id) into removed
    from couple_members a join couple_members b on a.couple_id = b.couple_id
    where a.user_id = p_user and b.user_id = other;
  else
    removed := array[p_couple];
  end if;

  delete from couples where id = any (removed);

  -- No longer connected at all: off each other's group plans, and no claims on each other's wishes.
  if p_block or not exists (
    select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
    where a.user_id = p_user and b.user_id = other
  ) then
    update events set
      hidden_from = nullif(array_remove(hidden_from, other), '{}'),
      surprise = surprise and cardinality(array_remove(hidden_from, other)) > 0
    where couple_id is null and created_by = p_user and other = any (hidden_from);
    update events set
      hidden_from = nullif(array_remove(hidden_from, p_user), '{}'),
      surprise = surprise and cardinality(array_remove(hidden_from, p_user)) > 0
    where couple_id is null and created_by = other and p_user = any (hidden_from);
    delete from event_participants ep using events e
    where e.id = ep.event_id and e.couple_id is null
      and ((e.created_by = p_user and ep.user_id = other) or (e.created_by = other and ep.user_id = p_user));
    delete from wish_claims c using wishes w
    where w.id = c.wish_id
      and ((w.owner = p_user and c.claimed_by = other) or (w.owner = other and c.claimed_by = p_user));
  end if;

  return removed;
end
$$;
revoke execute on function public.remove_connection_data(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.remove_connection_data(uuid, uuid, boolean) to service_role;

revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;
