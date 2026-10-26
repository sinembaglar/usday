-- In-app notification center: every push is also kept here, so nothing is lost
-- when phone notifications are off or a banner is swiped away.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient uuid not null references public.profiles on delete cascade,
  event_id uuid references public.events on delete cascade,
  title text not null,
  body text,
  url text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_inbox on public.notifications (recipient, created_at desc);

alter table public.notifications enable row level security;

create policy "own notifications" on public.notifications
  for select to authenticated using (recipient = auth.uid());
create policy "clear own notifications" on public.notifications
  for delete to authenticated using (recipient = auth.uid());

create function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where recipient = auth.uid() and read_at is null
$$;

revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

alter publication supabase_realtime add table public.notifications;
