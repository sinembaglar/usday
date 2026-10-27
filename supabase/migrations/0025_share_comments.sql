-- Talking about a plan on someone's shared calendar ("Bensiz mi? 😤"). It is a side conversation
-- between the calendar's owner and the person they share it with; the plan's other people never
-- see it. The viewer starts it while the calendar is shared; the owner can always answer.

-- Is this plan on this person's calendar (their connections' plans and the group plans they are on)?
create function public.on_calendar_of(p_event uuid, person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = p_event
      and (
        e.couple_id in (select m.couple_id from couple_members m where m.user_id = person)
        or (
          e.couple_id is null
          and (
            e.created_by = person
            or exists (
              select 1 from event_participants p
              where p.event_id = e.id and p.user_id = person and p.status <> 'declined'
            )
          )
        )
      )
  )
$$;
revoke execute on function public.on_calendar_of(uuid, uuid) from public, anon;
grant execute on function public.on_calendar_of(uuid, uuid) to authenticated; -- used by the policy below

create table public.share_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  owner uuid not null references auth.users on delete cascade, -- whose calendar
  viewer uuid not null references auth.users on delete cascade, -- who it is shared with
  author uuid not null references auth.users on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  check (author = owner or author = viewer)
);
create index share_comments_thread on public.share_comments (event_id, owner, viewer, created_at);
alter table public.share_comments enable row level security;

create policy "my side conversations" on public.share_comments
  for select to authenticated using (auth.uid() = owner or auth.uid() = viewer);

create policy "talk about a shared plan" on public.share_comments
  for insert to authenticated with check (
    author = auth.uid()
    and public.on_calendar_of(event_id, owner)
    and (
      -- the viewer, while the owner shares their calendar with them
      (auth.uid() = viewer and exists (
        select 1 from public.calendar_shares s where s.owner = share_comments.owner and s.viewer = auth.uid()
      ))
      -- the owner, answering someone who wrote to them about this plan
      or (auth.uid() = owner and exists (
        select 1 from public.share_comments c
        where c.event_id = share_comments.event_id and c.owner = auth.uid() and c.viewer = share_comments.viewer
      ))
    )
  );

create policy "delete what I wrote" on public.share_comments
  for delete to authenticated using (author = auth.uid());

alter publication supabase_realtime add table public.share_comments;

-- Sent by the database, like plan comments.
create function public.notify_new_share_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://uywvqxxjsbnwspdxwnhl.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'usday_cron_secret')
    ),
    body := jsonb_build_object('share_comment_id', new.id),
    timeout_milliseconds := 10000
  );
  return new;
end
$$;

create trigger share_comments_notify
  after insert on public.share_comments
  for each row execute function public.notify_new_share_comment();
