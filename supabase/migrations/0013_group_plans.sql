-- Group plans: a plan with several of my people. It has no connection (couple_id is null);
-- instead every invited person gets a participant row and answers "katılıyorum / katılamıyorum".
-- Invited people can see each other's names on that plan, even if they are not connected.

alter table public.events alter column couple_id drop not null;
alter table public.events alter column couple_id drop default;

-- Surprises stay two-person for now ("kimden gizli" comes later).
alter table public.events add constraint group_plan_is_not_a_surprise check (couple_id is not null or not surprise);

create table public.event_participants (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  note text check (length(note) <= 300),
  responded_at timestamptz,
  primary key (event_id, user_id)
);

create index event_participants_user on public.event_participants (user_id);

-- Am I invited to (or did I make) this group plan?
create function public.in_group_plan(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event and e.couple_id is null and e.created_by = auth.uid())
      or exists (select 1 from event_participants p where p.event_id = p_event and p.user_id = auth.uid())
$$;

-- Do I share a group plan with this person?
create function public.plans_with(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from events e
    join event_participants theirs on theirs.event_id = e.id
    left join event_participants mine on mine.event_id = e.id and mine.user_id = auth.uid()
    where e.couple_id is null
      and (theirs.user_id = person or e.created_by = person)
      and (mine.user_id is not null or e.created_by = auth.uid())
  )
$$;

alter table public.event_participants enable row level security;

create policy "people on my group plans" on public.event_participants
  for select to authenticated using (public.in_group_plan(event_id));
-- The plan's maker invites people they are connected with.
create policy "invite to my group plan" on public.event_participants
  for insert to authenticated with check (
    exists (select 1 from public.events e where e.id = event_id and e.couple_id is null and e.created_by = auth.uid())
    and (user_id = auth.uid() or public.connected(user_id))
  );
create policy "uninvite from my group plan" on public.event_participants
  for delete to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  );

-- Plans: two-person ones by connection, group ones by invitation.
drop policy "read visible events" on public.events;
drop policy "add events" on public.events;
drop policy "edit events" on public.events;
drop policy "delete events" on public.events;

create policy "read visible events" on public.events
  for select to authenticated using (
    (couple_id is null and public.in_group_plan(id))
    or (
      public.is_member(couple_id)
      and (created_by = auth.uid() or not surprise or reveal_on <= public.today_tr())
    )
  );
create policy "add events" on public.events
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      (couple_id is null and awaiting is null and not surprise)
      or (
        public.is_member(couple_id)
        and (
          awaiting is null
          or (awaiting <> auth.uid() and exists (select 1 from public.couple_members m where m.couple_id = events.couple_id and m.user_id = awaiting))
        )
      )
    )
  );
create policy "edit events" on public.events
  for update to authenticated using (
    (couple_id is null and created_by = auth.uid())
    or (public.is_member(couple_id) and (created_by = auth.uid() or not surprise))
  );
create policy "delete events" on public.events
  for delete to authenticated using (
    (couple_id is null and created_by = auth.uid())
    or (public.is_member(couple_id) and (created_by = auth.uid() or not surprise))
  );

-- Names (and colors) of people I share a group plan with.
drop policy "me and connected people" on public.profiles;
create policy "me, connected and co-invited people" on public.profiles
  for select to authenticated using (id = auth.uid() or public.connected(id) or public.plans_with(id));

-- An invited person answers for themselves.
create function public.answer_invitation(p_event uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'bad_answer';
  end if;
  update event_participants
  set status = p_status, note = nullif(trim(p_note), ''), responded_at = now()
  where event_id = p_event and user_id = auth.uid();
  if not found then
    raise exception 'not_invited';
  end if;
end
$$;
revoke execute on function public.answer_invitation(uuid, text, text) from public, anon;
grant execute on function public.answer_invitation(uuid, text, text) to authenticated;

-- Group plan photos sit in the maker's own folder; invited people may see them.
create or replace function public.can_see_folder(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text
      or folder in (select c::text from public.my_couples() c)
      or exists (
        select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
        where a.user_id = auth.uid() and b.user_id::text = folder
      )
      or exists (
        select 1 from events e join event_participants p on p.event_id = e.id
        where e.couple_id is null and e.created_by::text = folder and p.user_id = auth.uid()
      )
$$;

alter publication supabase_realtime add table public.event_participants;

-- Older app versions still on phones insert without couple_id; keep them landing in a connection.
-- The current app always sends couple_id (null for a group plan).
alter table public.events alter column couple_id set default public.my_couple_id();
