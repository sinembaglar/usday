-- Errors in people's apps: what broke, where, and on which device, so we hear about problems before
-- anyone has to tell us. Anyone can report one (also before signing in); only the admins can read them,
-- through admin_errors(). The first report of each kind in a day sends the admins a notification.
-- Reports are kept for 30 days.

create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users on delete set null,
  kind text not null check (kind in ('error', 'rejection', 'render', 'load')),
  message text not null check (length(message) between 1 and 500),
  stack text check (length(stack) <= 4000),
  url text check (length(url) <= 300),
  user_agent text check (length(user_agent) <= 300),
  version text check (length(version) <= 60),
  created_at timestamptz not null default now()
);
create index client_errors_created on public.client_errors (created_at desc);
create index client_errors_message on public.client_errors (message, created_at desc);
create index client_errors_user on public.client_errors (user_id);
alter table public.client_errors enable row level security;
create policy "anyone reports errors" on public.client_errors
  for insert to anon, authenticated with check (user_id is null or user_id = (select auth.uid()));

-- A page that keeps failing could send reports in a loop: at most 20 a minute per person
-- (and 20 a minute from everyone signed out together). Extra reports are dropped quietly.
create function public.client_error_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (
    select count(*) from client_errors e
    where e.user_id is not distinct from new.user_id and e.created_at > now() - interval '1 minute'
  ) >= 20 then
    return null;
  end if;
  return new;
end
$$;
create trigger client_errors_guard before insert on public.client_errors
  for each row execute function public.client_error_guard();

-- The first report of an error in a day tells the admins.
create function public.announce_client_error() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from client_errors e
    where e.message = new.message and e.id <> new.id and e.created_at > now() - interval '1 day'
  ) then
    return new;
  end if;
  perform net.http_post(
    url := 'https://uywvqxxjsbnwspdxwnhl.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'usday_cron_secret')
    ),
    body := jsonb_build_object('client_error_id', new.id),
    timeout_milliseconds := 10000
  );
  return new;
end
$$;
create trigger client_errors_announce after insert on public.client_errors
  for each row execute function public.announce_client_error();

-- For the admin panel: the last 14 days, one row per error message.
create function public.admin_errors() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return coalesce((
    select jsonb_agg(g order by g->>'last_at' desc)
    from (
      select jsonb_build_object(
        'message', message,
        'kind', (array_agg(kind order by created_at desc))[1],
        'count', count(*),
        'people', count(distinct user_id),
        'first_at', min(created_at),
        'last_at', max(created_at),
        'stack', (array_agg(stack order by created_at desc))[1],
        'url', (array_agg(url order by created_at desc))[1],
        'user_agent', (array_agg(user_agent order by created_at desc))[1],
        'version', (array_agg(version order by created_at desc))[1]
      ) g
      from client_errors
      where created_at > now() - interval '14 days'
      group by message
      order by max(created_at) desc
      limit 100
    ) x
  ), '[]'::jsonb);
end
$$;
revoke execute on function public.admin_errors() from public, anon;
grant execute on function public.admin_errors() to authenticated;
revoke execute on function public.client_error_guard() from public, anon, authenticated;
revoke execute on function public.announce_client_error() from public, anon, authenticated;

select cron.schedule(
  'usday-client-errors-cleanup',
  '17 3 * * *',
  $$delete from public.client_errors where created_at < now() - interval '30 days'$$
);
