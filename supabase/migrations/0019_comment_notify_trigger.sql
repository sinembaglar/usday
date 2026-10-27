-- Comment notifications are sent by the database, not the phone: a phone that closes the app
-- right after sending used to drop the notification. notified_at makes sure it goes out once,
-- also while older app versions still ask for it themselves.

alter table public.event_comments add column notified_at timestamptz;

create function public.notify_new_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://uywvqxxjsbnwspdxwnhl.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'usday_cron_secret')
    ),
    body := jsonb_build_object('comment_id', new.id),
    timeout_milliseconds := 10000
  );
  return new;
end
$$;

create trigger event_comments_notify
  after insert on public.event_comments
  for each row execute function public.notify_new_comment();
