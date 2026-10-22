-- Unread badge: what the partner added since I last opened the app.
alter table public.profiles add column last_seen_at timestamptz not null default now();

create function public.mark_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid()
$$;

revoke execute on function public.mark_seen() from public, anon;
grant execute on function public.mark_seen() to authenticated;

-- Teasers now carry created_at so new surprises can be marked as new too.
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
  photos text[]
)
language sql stable security definer set search_path = public as $$
  select e.id, e.event_date, e.event_time, e.teaser, e.reveal_on, e.created_by, e.created_at,
         coalesce(array_length(e.photos, 1), 0),
         case when e.blur_photos then '{}'::text[] else e.photos end
  from events e
  where e.couple_id = public.my_couple_id()
    and e.surprise
    and e.created_by <> auth.uid()
    and e.reveal_on > public.today_tr()
$$;

revoke execute on function public.surprise_teasers() from public, anon;
grant execute on function public.surprise_teasers() to authenticated;

-- Calendar subscription (webcal) links. Kept in their own table so the
-- partner can never read my token and see my surprises through my feed.
create table public.calendar_tokens (
  user_id uuid primary key references public.profiles on delete cascade,
  token uuid not null unique default gen_random_uuid()
);

alter table public.calendar_tokens enable row level security;

create function public.my_calendar_token(renew boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  result uuid;
begin
  if renew then
    delete from calendar_tokens where user_id = auth.uid();
  end if;
  insert into calendar_tokens (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select token into result from calendar_tokens where user_id = auth.uid();
  return result;
end
$$;

revoke execute on function public.my_calendar_token(boolean) from public, anon;
grant execute on function public.my_calendar_token(boolean) to authenticated;
