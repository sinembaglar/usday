-- UsDay: couples, profiles, events, photo storage

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  cover_path text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  couple_id uuid not null references public.couples on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

-- Helpers -------------------------------------------------------------------

create function public.my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from profiles where id = auth.uid()
$$;

create function public.today_tr() returns date
language sql stable as $$
  select (now() at time zone 'Europe/Istanbul')::date
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple_id() references public.couples on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null,
  event_date date not null,
  event_time time,
  tag text not null default 'date',
  note text,
  photos text[] not null default '{}',
  surprise boolean not null default false,
  teaser text,
  reveal_on date,
  blur_photos boolean not null default false,
  created_at timestamptz not null default now()
);

create index events_couple_date on public.events (couple_id, event_date);

-- Every new user joins the first couple that still has room, or starts one.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  members int;
begin
  select c.id into cid
  from couples c
  where (select count(*) from profiles p where p.couple_id = c.id) < 2
  order by c.created_at
  limit 1;

  if cid is null then
    insert into couples default values returning id into cid;
  end if;

  select count(*) into members from profiles where couple_id = cid;

  insert into profiles (id, couple_id, name, color)
  values (
    new.id,
    cid,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when members = 0 then '#C58FB8' else '#8AA0C9' end
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security ----------------------------------------------------------

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;

create policy "own couple" on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy "update own couple" on public.couples
  for update to authenticated using (id = public.my_couple_id());

create policy "couple members" on public.profiles
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Partners never receive a surprise row before its reveal day.
create policy "read visible events" on public.events
  for select to authenticated using (
    couple_id = public.my_couple_id()
    and (created_by = auth.uid() or not surprise or reveal_on <= public.today_tr())
  );
create policy "add events" on public.events
  for insert to authenticated with check (
    couple_id = public.my_couple_id() and created_by = auth.uid()
  );
create policy "edit events" on public.events
  for update to authenticated using (
    couple_id = public.my_couple_id() and (created_by = auth.uid() or not surprise)
  );
create policy "delete events" on public.events
  for delete to authenticated using (
    couple_id = public.my_couple_id() and (created_by = auth.uid() or not surprise)
  );

-- What the partner may see of a hidden surprise: the teaser, the day and
-- either the photos (if not blurred) or only how many there are.
create function public.surprise_teasers()
returns table (
  id uuid,
  event_date date,
  event_time time,
  teaser text,
  reveal_on date,
  created_by uuid,
  photo_count int,
  photos text[]
)
language sql stable security definer set search_path = public as $$
  select e.id, e.event_date, e.event_time, e.teaser, e.reveal_on, e.created_by,
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

-- Realtime --------------------------------------------------------------------

alter publication supabase_realtime add table public.events;

-- Photo storage: one private folder per couple --------------------------------

insert into storage.buckets (id, name, public) values ('photos', 'photos', false);

create policy "couple photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
create policy "couple photos upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
create policy "couple photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
