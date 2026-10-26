-- Connections: one person can share UsDay with several people (partner, friend, sibling, family).
-- A "couple" row is now one two-person connection; membership moves to couple_members.
-- my_couple_id() and the couple_id defaults stay for older app versions during the rollout.

create table public.couple_members (
  couple_id uuid not null references public.couples on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create index couple_members_user on public.couple_members (user_id);

insert into public.couple_members (couple_id, user_id, joined_at)
select couple_id, id, created_at from public.profiles where couple_id is not null;

alter table public.couples
  add column relation text not null default 'partner' check (relation in ('partner', 'friend', 'sibling', 'family')),
  add column created_by uuid references public.profiles on delete set null;

update public.couples c
set created_by = (select m.user_id from public.couple_members m where m.couple_id = c.id order by m.joined_at limit 1);

-- Deleting a connection must never delete a person.
alter table public.profiles drop constraint profiles_couple_id_fkey;
alter table public.profiles alter column couple_id drop not null;

-- Helpers ---------------------------------------------------------------------

create or replace function public.my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from couple_members where user_id = auth.uid() order by joined_at limit 1
$$;

create function public.my_couples() returns setof uuid
language sql stable security definer set search_path = public as $$
  select couple_id from couple_members where user_id = auth.uid()
$$;

create function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couple_members where couple_id = c and user_id = auth.uid())
$$;

-- Do I share at least one connection with this person?
create function public.connected(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
    where a.user_id = auth.uid() and b.user_id = person
  )
$$;

-- Connections and people ---------------------------------------------------------

alter table public.couple_members enable row level security;
create policy "members of my connections" on public.couple_members
  for select to authenticated using (public.is_member(couple_id));

drop policy "own couple" on public.couples;
drop policy "update own couple" on public.couples;
create policy "my connections" on public.couples
  for select to authenticated using (public.is_member(id));
create policy "update my connections" on public.couples
  for update to authenticated using (public.is_member(id));

drop policy "couple members" on public.profiles;
create policy "me and connected people" on public.profiles
  for select to authenticated using (id = auth.uid() or public.connected(id));

-- Plans --------------------------------------------------------------------------

drop policy "read visible events" on public.events;
drop policy "add events" on public.events;
drop policy "edit events" on public.events;
drop policy "delete events" on public.events;

create policy "read visible events" on public.events
  for select to authenticated using (
    public.is_member(couple_id)
    and (created_by = auth.uid() or not surprise or reveal_on <= public.today_tr())
  );
create policy "add events" on public.events
  for insert to authenticated with check (
    public.is_member(couple_id)
    and created_by = auth.uid()
    and (
      awaiting is null
      or (awaiting <> auth.uid() and exists (select 1 from public.couple_members m where m.couple_id = events.couple_id and m.user_id = awaiting))
    )
  );
create policy "edit events" on public.events
  for update to authenticated using (public.is_member(couple_id) and (created_by = auth.uid() or not surprise));
create policy "delete events" on public.events
  for delete to authenticated using (public.is_member(couple_id) and (created_by = auth.uid() or not surprise));

create or replace function public.surprise_teasers()
returns table (
  id uuid,
  event_date date,
  event_time time,
  teaser text,
  reveal_on date,
  created_by uuid,
  created_at timestamptz,
  photo_count int,
  photos text[],
  status text,
  awaiting uuid,
  response_note text
)
language sql stable security definer set search_path = public as $$
  select e.id, e.event_date, e.event_time, e.teaser, e.reveal_on, e.created_by, e.created_at,
         coalesce(array_length(e.photos, 1), 0),
         case when e.blur_photos then '{}'::text[] else e.photos end,
         e.status, e.awaiting, e.response_note
  from events e
  where e.couple_id in (select public.my_couples())
    and e.surprise
    and e.created_by <> auth.uid()
    and e.reveal_on > public.today_tr()
$$;

-- The teaser now also says which connection it belongs to.
create function public.surprise_teaser_connections()
returns table (id uuid, couple_id uuid)
language sql stable security definer set search_path = public as $$
  select e.id, e.couple_id from events e
  where e.couple_id in (select public.my_couples())
    and e.surprise and e.created_by <> auth.uid() and e.reveal_on > public.today_tr()
$$;
revoke execute on function public.surprise_teaser_connections() from public, anon;
grant execute on function public.surprise_teaser_connections() to authenticated;

create or replace function public.respond_to_plan(
  p_event uuid,
  p_answer text,
  p_date date default null,
  p_time time default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  e events;
  other uuid;
begin
  select * into e from events
  where id = p_event and public.is_member(couple_id) and status = 'proposed' and awaiting = auth.uid();
  if not found then
    raise exception 'not_awaiting';
  end if;

  if p_answer = 'accept' then
    update events set status = 'confirmed', awaiting = null, response_note = nullif(trim(p_note), '') where id = p_event;
  elsif p_answer = 'decline' then
    update events set status = 'declined', awaiting = null, response_note = nullif(trim(p_note), '') where id = p_event;
  elsif p_answer = 'counter' and p_date is not null then
    select user_id into other from couple_members where couple_id = e.couple_id and user_id <> auth.uid() limit 1;
    update events set
      event_date = p_date,
      event_time = p_time,
      end_time = case when p_time is not null and end_time > p_time then end_time end,
      reveal_on = case when surprise then least(coalesce(reveal_on, p_date), p_date) end,
      awaiting = other,
      response_note = nullif(trim(p_note), '')
    where id = p_event;
  else
    raise exception 'bad_answer';
  end if;
end
$$;

-- Templates stay per connection.
drop policy "couple templates" on public.custom_templates;
drop policy "add couple templates" on public.custom_templates;
drop policy "remove couple templates" on public.custom_templates;
create policy "connection templates" on public.custom_templates
  for select to authenticated using (public.is_member(couple_id));
create policy "add connection templates" on public.custom_templates
  for insert to authenticated with check (public.is_member(couple_id) and created_by = auth.uid());
create policy "remove connection templates" on public.custom_templates
  for delete to authenticated using (public.is_member(couple_id));

-- Wishes belong to a person and are visible to everyone they are connected with.
alter table public.wishes alter column couple_id drop not null;
alter table public.wishes alter column couple_id drop default;
update public.wishes set couple_id = null;

drop policy "couple wishes" on public.wishes;
drop policy "add own wishes" on public.wishes;
create policy "my and connected wishes" on public.wishes
  for select to authenticated using (owner = auth.uid() or public.connected(owner));
create policy "add own wishes" on public.wishes
  for insert to authenticated with check (owner = auth.uid());

drop policy "claim partner wish" on public.wish_claims;
create policy "claim connected wish" on public.wish_claims
  for insert to authenticated with check (
    claimed_by = auth.uid()
    and exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.owner <> auth.uid() and public.connected(w.owner) and w.status = 'open'
    )
  );

create or replace function public.complete_wish(p_wish uuid) returns void
language sql security definer set search_path = public as $$
  update wishes set status = 'done', done_at = now()
  where id = p_wish
    and (owner = auth.uid() or exists (select 1 from wish_claims c where c.wish_id = p_wish and c.claimed_by = auth.uid()))
$$;

-- Photos: a folder per connection, plus a personal folder (wish photos) shown to connected people.

create or replace function public.is_hidden_photo(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where public.is_member(e.couple_id)
      and e.surprise
      and e.blur_photos
      and e.created_by <> auth.uid()
      and e.reveal_on > public.today_tr()
      and object_name = any (e.photos)
  )
$$;

create function public.can_see_folder(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text
      or folder in (select c::text from public.my_couples() c)
      or exists (
        select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
        where a.user_id = auth.uid() and b.user_id::text = folder
      )
$$;

create function public.can_write_folder(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text or folder in (select c::text from public.my_couples() c)
$$;

drop policy "couple photos read" on storage.objects;
drop policy "couple photos upload" on storage.objects;
drop policy "couple photos delete" on storage.objects;
create policy "connection photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.can_see_folder((storage.foldername(name))[1]) and not public.is_hidden_photo(name));
create policy "connection photos upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.can_write_folder((storage.foldername(name))[1]));
create policy "connection photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.can_write_folder((storage.foldername(name))[1]));

-- Joining and creating connections ---------------------------------------------------

create or replace function public.open_couple(code text) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from couples c
  where c.invite_code = upper(trim(code))
    and (select count(*) from couple_members m where m.couple_id = c.id) < 2
$$;

create or replace function public.check_invite(code text) returns text
language sql stable security definer set search_path = public as $$
  select p.name from couple_members m join profiles p on p.id = m.user_id
  where m.couple_id = public.open_couple(code) limit 1
$$;

-- New account: join the connection behind the invite code, or open a first one to share.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.open_couple(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  joining boolean := cid is not null;
begin
  insert into profiles (id, name, color)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when joining then '#8AA0C9' else '#C58FB8' end
  );
  if not joining then
    insert into couples (created_by) values (new.id) returning id into cid;
  end if;
  insert into couple_members (couple_id, user_id) values (cid, new.id);
  return new;
end
$$;

-- Existing account joins someone's connection with their code (adds, never moves).
drop function public.join_couple(text);
create function public.join_couple(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target uuid := public.open_couple(code);
  inviter uuid;
begin
  if target is null or public.is_member(target) then
    raise exception 'invalid_invite';
  end if;
  select user_id into inviter from couple_members where couple_id = target limit 1;
  if public.connected(inviter) then
    raise exception 'already_connected';
  end if;
  insert into couple_members (couple_id, user_id) values (target, auth.uid());
  return target;
end
$$;
revoke execute on function public.join_couple(text) from public, anon;
grant execute on function public.join_couple(text) to authenticated;

-- A new, still empty connection to invite someone into.
create function public.create_connection(p_relation text default 'partner') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  insert into couples (created_by, relation) values (auth.uid(), p_relation) returning id into cid;
  insert into couple_members (couple_id, user_id) values (cid, auth.uid());
  return cid;
end
$$;
revoke execute on function public.create_connection(text) from public, anon;
grant execute on function public.create_connection(text) to authenticated;

-- Cancel an invitation nobody has accepted yet (a connection with only me in it and no plans).
create function public.cancel_connection(p_couple uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_couple)
     or (select count(*) from couple_members where couple_id = p_couple) > 1
     or exists (select 1 from events where couple_id = p_couple) then
    raise exception 'cannot_cancel';
  end if;
  delete from couples where id = p_couple;
end
$$;
revoke execute on function public.cancel_connection(uuid) from public, anon;
grant execute on function public.cancel_connection(uuid) to authenticated;
