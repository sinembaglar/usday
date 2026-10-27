-- Sharing my calendar with people I am connected with: they see when I am busy ("busy") or also
-- the names of my plans ("details"). Places, notes, photos, other people and surprise names are
-- never shared; a surprise only ever shows as busy time.

create table public.calendar_shares (
  owner uuid not null references auth.users on delete cascade,
  viewer uuid not null references auth.users on delete cascade,
  level text not null default 'busy' check (level in ('busy', 'details')),
  created_at timestamptz not null default now(),
  primary key (owner, viewer),
  check (owner <> viewer)
);
alter table public.calendar_shares enable row level security;

create policy "my shares" on public.calendar_shares
  for select to authenticated using (owner = auth.uid() or viewer = auth.uid());
create policy "share with someone I know" on public.calendar_shares
  for insert to authenticated with check (owner = auth.uid() and public.connected(viewer));
create policy "change my shares" on public.calendar_shares
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid() and public.connected(viewer));
create policy "stop sharing" on public.calendar_shares
  for delete to authenticated using (owner = auth.uid());

-- Everything on the calendars shared with me (repeating plans come as series, like events).
create function public.shared_calendar()
returns table (
  id uuid, owner uuid, event_date date, event_time time, end_time time,
  repeat text, repeat_until date, skip_dates date[], title text, tag text, status text
)
language sql stable security definer set search_path = public as $$
  select e.id, s.owner, e.event_date, e.event_time, e.end_time,
         e.repeat, e.repeat_until, e.skip_dates,
         case when s.level = 'details' and not e.surprise then e.title end,
         case when s.level = 'details' and not e.surprise then e.tag end,
         e.status
  from calendar_shares s
  join events e on (
    e.couple_id in (select m.couple_id from couple_members m where m.user_id = s.owner)
    or (
      e.couple_id is null
      and (
        e.created_by = s.owner
        or exists (
          select 1 from event_participants p
          where p.event_id = e.id and p.user_id = s.owner and p.status <> 'declined'
        )
      )
    )
  )
  where s.viewer = auth.uid()
    and public.connected(s.owner)
    and e.status <> 'declined'
$$;
revoke execute on function public.shared_calendar() from public, anon;
grant execute on function public.shared_calendar() to authenticated;

-- Removing a connection or blocking someone also ends calendar sharing between them.
create or replace function public.end_shares_on_leave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from calendar_shares s
  where (s.owner = old.user_id or s.viewer = old.user_id)
    and not exists (
      select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
      where a.user_id = s.owner and b.user_id = s.viewer
    );
  return old;
end
$$;

create trigger couple_members_end_shares
  after delete on public.couple_members
  for each row execute function public.end_shares_on_leave();
