-- Web push subscriptions, reminder bookkeeping and the reminder schedule.

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "own subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "remove own subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- A device can move between accounts, so the endpoint is re-assigned on save.
create function public.save_push_subscription(endpoint text, p256dh text, auth text) returns void
language sql security definer set search_path = public as $$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values (endpoint, auth.uid(), p256dh, auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Each reminder kind goes out once per event and person. Server-side only.
create table public.sent_notifications (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id, kind)
);

alter table public.sent_notifications enable row level security;

-- Moving an event to another day or time makes its reminders due again.
create function public.reset_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_date is distinct from old.event_date
     or new.event_time is distinct from old.event_time
     or new.reveal_on is distinct from old.reveal_on then
    delete from sent_notifications where event_id = new.id;
  end if;
  return new;
end
$$;

create trigger events_reset_reminders
  after update on public.events
  for each row execute function public.reset_reminders();

-- Every 10 minutes ask the reminders function what is due.
-- The shared secret lives in Vault as 'usday_cron_secret' (set outside the repo).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'usday-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://uywvqxxjsbnwspdxwnhl.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'usday_cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
