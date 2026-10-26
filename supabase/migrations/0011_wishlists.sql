-- Wish lists: gifts, places and things each partner would love.
-- The partner can secretly claim a wish ("bunu ben alıyorum") and turn it into a surprise plan.
-- Claims live in their own table that only the claimer can read, so the wish owner never sees them.

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple_id() references public.couples on delete cascade,
  owner uuid not null default auth.uid() references public.profiles on delete cascade,
  category text not null default 'gift' check (category in ('gift', 'travel', 'experience')),
  title text not null check (length(trim(title)) between 1 and 120),
  link text check (length(link) <= 500),
  price text check (length(price) <= 40),
  note text check (length(note) <= 1000),
  photo_path text,
  loved boolean not null default false,
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index wishes_couple on public.wishes (couple_id, created_at desc);

alter table public.wishes enable row level security;

create policy "couple wishes" on public.wishes
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "add own wishes" on public.wishes
  for insert to authenticated with check (couple_id = public.my_couple_id() and owner = auth.uid());
create policy "edit own wishes" on public.wishes
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "delete own wishes" on public.wishes
  for delete to authenticated using (owner = auth.uid());

create table public.wish_claims (
  wish_id uuid primary key references public.wishes on delete cascade,
  claimed_by uuid not null default auth.uid() references public.profiles on delete cascade,
  plan_id uuid references public.events on delete set null,
  created_at timestamptz not null default now()
);

alter table public.wish_claims enable row level security;

-- Only the claimer ever sees a claim; you can only claim your partner's open wish.
create policy "my claims" on public.wish_claims
  for select to authenticated using (claimed_by = auth.uid());
create policy "claim partner wish" on public.wish_claims
  for insert to authenticated with check (
    claimed_by = auth.uid()
    and exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.couple_id = public.my_couple_id() and w.owner <> auth.uid() and w.status = 'open'
    )
  );
create policy "update my claims" on public.wish_claims
  for update to authenticated using (claimed_by = auth.uid()) with check (claimed_by = auth.uid());
create policy "drop my claims" on public.wish_claims
  for delete to authenticated using (claimed_by = auth.uid());

-- Owner or the person who made it happen can mark a wish as come true.
create function public.complete_wish(p_wish uuid) returns void
language sql security definer set search_path = public as $$
  update wishes set status = 'done', done_at = now()
  where id = p_wish
    and couple_id = public.my_couple_id()
    and (owner = auth.uid() or exists (select 1 from wish_claims c where c.wish_id = p_wish and c.claimed_by = auth.uid()))
$$;

revoke execute on function public.complete_wish(uuid) from public, anon;
grant execute on function public.complete_wish(uuid) to authenticated;

alter publication supabase_realtime add table public.wishes;
