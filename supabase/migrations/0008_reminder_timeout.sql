-- The reminders run can take longer than pg_net's default 5 s once several pushes go out.
select cron.unschedule('usday-reminders');

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
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $$
);
