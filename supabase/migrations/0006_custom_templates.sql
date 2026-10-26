-- Plan templates a couple adds themselves, shared by both partners.

create table public.custom_templates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default public.my_couple_id() references public.couples on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles on delete cascade,
  tag text not null,
  title text not null check (length(trim(title)) between 1 and 60),
  event_time time,
  created_at timestamptz not null default now(),
  unique (couple_id, tag, title)
);

alter table public.custom_templates enable row level security;

create policy "couple templates" on public.custom_templates
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "add couple templates" on public.custom_templates
  for insert to authenticated with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy "remove couple templates" on public.custom_templates
  for delete to authenticated using (couple_id = public.my_couple_id());
