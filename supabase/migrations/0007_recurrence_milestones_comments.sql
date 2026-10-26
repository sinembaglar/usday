-- Recurring plans, end time and place; the couple's "together since" day;
-- comments and emoji reactions on plans.

-- Plans --------------------------------------------------------------------------

alter table public.events
  add column end_time time,
  add column location text check (length(location) <= 200),
  add column repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  add column repeat_until date,
  add column skip_dates date[] not null default '{}';

-- A surprise is a one-off.
alter table public.events add constraint surprise_does_not_repeat check (not surprise or repeat = 'none');

create or replace function public.reset_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_date is distinct from old.event_date
     or new.event_time is distinct from old.event_time
     or new.reveal_on is distinct from old.reveal_on
     or new.repeat is distinct from old.repeat then
    delete from sent_notifications where event_id = new.id;
  end if;
  return new;
end
$$;

-- Together since ------------------------------------------------------------------

alter table public.couples add column together_since date check (together_since <= current_date + 1);

-- Anniversary and day-count reminders have no event row, so they are tracked per couple.
create table public.sent_milestones (
  couple_id uuid not null references public.couples on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (couple_id, user_id, key)
);

alter table public.sent_milestones enable row level security;

-- Comments and reactions ------------------------------------------------------------
-- Both follow the plan's own visibility: nobody can read or write on a surprise
-- that is still hidden from them, because the events policy hides that row.

create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  author uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index event_comments_event on public.event_comments (event_id, created_at);

create table public.event_reactions (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  emoji text not null check (emoji in ('😍', '🥳', '👍', '😂', '🙈')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_comments enable row level security;
alter table public.event_reactions enable row level security;

create policy "read comments on visible plans" on public.event_comments
  for select to authenticated using (exists (select 1 from public.events e where e.id = event_id));
create policy "comment on visible plans" on public.event_comments
  for insert to authenticated with check (
    author = auth.uid() and exists (select 1 from public.events e where e.id = event_id)
  );
create policy "delete own comments" on public.event_comments
  for delete to authenticated using (author = auth.uid());

create policy "read reactions on visible plans" on public.event_reactions
  for select to authenticated using (exists (select 1 from public.events e where e.id = event_id));
create policy "react to visible plans" on public.event_reactions
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id)
  );
create policy "change own reaction" on public.event_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own reaction" on public.event_reactions
  for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.event_comments, public.event_reactions;
