-- Group surprises: a group plan can be a surprise for some of its guests ("kimden gizli").
-- Until the reveal day those guests see only the teaser and the time, can still say whether
-- they are free, and cannot see who else is in on it or what is being said.

alter table public.events add column hidden_from uuid[];

alter table public.events drop constraint group_plan_is_not_a_surprise;
alter table public.events add constraint group_surprise_has_a_target check (
  couple_id is not null or not surprise or coalesce(cardinality(hidden_from), 0) > 0
);

-- Is this plan still a secret for me?
create function public.secret_for_me(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = p_event and e.surprise and e.reveal_on > public.today_tr()
      and (
        (e.couple_id is null and auth.uid() = any (e.hidden_from))
        or (e.couple_id is not null and e.created_by <> auth.uid())
      )
  )
$$;

drop policy "read visible events" on public.events;
create policy "read visible events" on public.events
  for select to authenticated using (
    (couple_id is null and (created_by = auth.uid() or (public.in_group_plan(id) and not public.secret_for_me(id))))
    or (
      public.is_member(couple_id)
      and (created_by = auth.uid() or not surprise or reveal_on <= public.today_tr())
    )
  );

-- The surprised guest must not see who else is invited.
drop policy "people on my group plans" on public.event_participants;
create policy "people on my group plans" on public.event_participants
  for select to authenticated using (
    public.in_group_plan(event_id) and (user_id = auth.uid() or not public.secret_for_me(event_id))
  );

-- Only the plan's maker can make someone a target, and only a guest of that plan.
create or replace function public.check_hidden_from() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.couple_id is null and new.hidden_from is not null then
    if exists (
      select 1 from unnest(new.hidden_from) t
      where t = new.created_by
    ) then
      raise exception 'cannot_hide_from_maker';
    end if;
  end if;
  return new;
end
$$;

create trigger events_check_hidden_from
  before insert or update on public.events
  for each row execute function public.check_hidden_from();

-- Teasers for everything still secret for me: two-person surprises and group surprises.
drop function public.surprise_teasers();
create function public.surprise_teasers()
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
  response_note text,
  my_answer text
)
language sql stable security definer set search_path = public as $$
  select e.id, e.event_date, e.event_time, e.teaser, e.reveal_on, e.created_by, e.created_at,
         coalesce(array_length(e.photos, 1), 0),
         case when e.blur_photos then '{}'::text[] else e.photos end,
         e.status, e.awaiting, e.response_note,
         (select p.status from event_participants p where p.event_id = e.id and p.user_id = auth.uid())
  from events e
  where e.surprise and e.reveal_on > public.today_tr()
    and (
      (e.couple_id in (select public.my_couples()) and e.created_by <> auth.uid())
      or (e.couple_id is null and auth.uid() = any (e.hidden_from)
          and exists (select 1 from event_participants p where p.event_id = e.id and p.user_id = auth.uid()))
    )
$$;
revoke execute on function public.surprise_teasers() from public, anon;
grant execute on function public.surprise_teasers() to authenticated;

create or replace function public.surprise_teaser_connections()
returns table (id uuid, couple_id uuid)
language sql stable security definer set search_path = public as $$
  select e.id, e.couple_id from events e
  where e.surprise and e.reveal_on > public.today_tr()
    and (
      (e.couple_id in (select public.my_couples()) and e.created_by <> auth.uid())
      or (e.couple_id is null and auth.uid() = any (e.hidden_from))
    )
$$;

-- Blurred photos stay hidden from every target, in groups too.
create or replace function public.is_hidden_photo(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.surprise
      and e.blur_photos
      and e.reveal_on > public.today_tr()
      and object_name = any (e.photos)
      and (
        (public.is_member(e.couple_id) and e.created_by <> auth.uid())
        or (e.couple_id is null and auth.uid() = any (e.hidden_from))
      )
  )
$$;

-- A surprise must not reveal who is in on it: sharing a still-secret plan does not count.
create or replace function public.plans_with(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from events e
    join event_participants theirs on theirs.event_id = e.id
    left join event_participants mine on mine.event_id = e.id and mine.user_id = auth.uid()
    where e.couple_id is null
      and (theirs.user_id = person or e.created_by = person)
      and (mine.user_id is not null or e.created_by = auth.uid())
      and not public.secret_for_me(e.id)
  )
$$;

-- Group plans may now be surprises (with someone to hide them from).
drop policy "add events" on public.events;
create policy "add events" on public.events
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      (couple_id is null and awaiting is null and (not surprise or coalesce(cardinality(hidden_from), 0) > 0))
      or (
        public.is_member(couple_id)
        and (
          awaiting is null
          or (awaiting <> auth.uid() and exists (select 1 from public.couple_members m where m.couple_id = events.couple_id and m.user_id = awaiting))
        )
      )
    )
  );
