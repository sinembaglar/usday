-- Running the app: feedback from users, reports about people, and an admin who can see
-- the numbers, read both, and ban someone. The admin sees counts, never anyone's plans.

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security; -- read only through is_admin()

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
grant execute on function public.is_admin() to authenticated;

insert into public.admins (user_id)
select id from auth.users where email = 'sinembglr@gmail.com';

-- Feedback ------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  author uuid references auth.users on delete set null,
  kind text not null check (kind in ('idea', 'bug', 'love', 'other')),
  message text not null check (length(trim(message)) between 1 and 2000),
  device text check (length(device) <= 300),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index feedback_newest on public.feedback (created_at desc);
alter table public.feedback enable row level security;

create policy "send feedback" on public.feedback
  for insert to authenticated with check (author = auth.uid() and status = 'new');
create policy "admin reads feedback" on public.feedback
  for select to authenticated using (public.is_admin());
create policy "admin updates feedback" on public.feedback
  for update to authenticated using (public.is_admin());

-- Reports about a person I am connected with or share a plan with ----------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references auth.users on delete set null,
  reported uuid references auth.users on delete set null,
  reason text not null check (reason in ('harassment', 'inappropriate', 'spam', 'other')),
  message text check (length(message) <= 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);
create index reports_newest on public.reports (created_at desc);
alter table public.reports enable row level security;

create policy "report someone I know" on public.reports
  for insert to authenticated with check (
    reporter = auth.uid()
    and reported <> auth.uid()
    and status = 'new'
    and (public.connected(reported) or public.plans_with(reported))
  );
create policy "admin reads reports" on public.reports
  for select to authenticated using (public.is_admin());
create policy "admin updates reports" on public.reports
  for update to authenticated using (public.is_admin());

-- What the admin did, for the record (written by the admin function).
create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  admin uuid references auth.users on delete set null,
  target uuid,
  action text not null check (action in ('ban', 'unban')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;
create policy "admin reads log" on public.moderation_log
  for select to authenticated using (public.is_admin());

-- The report: counts only ----------------------------------------------------------

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from profiles),
    'users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from profiles where created_at > now() - interval '30 days'),
    'active_1d', (select count(*) from profiles where last_seen_at > now() - interval '1 day'),
    'active_7d', (select count(*) from profiles where last_seen_at > now() - interval '7 days'),
    'banned', (select count(*) from auth.users where banned_until > now()),
    'connections', (
      select coalesce(jsonb_object_agg(relation, n), '{}'::jsonb)
      from (
        select c.relation, count(*) n from couples c
        where (select count(*) from couple_members m where m.couple_id = c.id) = 2
        group by c.relation
      ) x
    ),
    'open_invites', (
      select count(*) from couples c
      where (select count(*) from couple_members m where m.couple_id = c.id) < 2
    ),
    'plans', (select count(*) from events),
    'plans_7d', (select count(*) from events where created_at > now() - interval '7 days'),
    'group_plans', (select count(*) from events where couple_id is null),
    'surprises', (select count(*) from events where surprise),
    'proposals', (select count(*) from events where status = 'proposed'),
    'comments_7d', (select count(*) from event_comments where created_at > now() - interval '7 days'),
    'wishes', (select count(*) from wishes),
    'devices', (select count(*) from push_subscriptions),
    'notifications_7d', (select count(*) from notifications where created_at > now() - interval '7 days'),
    'feedback_new', (select count(*) from feedback where status = 'new'),
    'reports_open', (select count(*) from reports where status <> 'closed'),
    'signups_by_day', (
      select jsonb_agg(jsonb_build_object('day', d::date, 'n', (
        select count(*) from profiles p where (p.created_at at time zone 'Europe/Istanbul')::date = d::date
      )) order by d)
      from generate_series((now() at time zone 'Europe/Istanbul')::date - 13, (now() at time zone 'Europe/Istanbul')::date, interval '1 day') d
    ),
    'plans_by_day', (
      select jsonb_agg(jsonb_build_object('day', d::date, 'n', (
        select count(*) from events e where (e.created_at at time zone 'Europe/Istanbul')::date = d::date
      )) order by d)
      from generate_series((now() at time zone 'Europe/Istanbul')::date - 13, (now() at time zone 'Europe/Istanbul')::date, interval '1 day') d
    ),
    'reminders_last_run', (
      select max(d.end_time) from cron.job_run_details d join cron.job j on j.jobid = d.jobid
      where j.jobname = 'usday-reminders' and d.status = 'succeeded'
    ),
    'reminders_failed_24h', (
      select count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid
      where j.jobname = 'usday-reminders' and d.status = 'failed' and d.start_time > now() - interval '1 day'
    ),
    'background_errors_24h', (
      select count(*) from net._http_response r
      where r.created > now() - interval '1 day' and (r.status_code >= 400 or r.timed_out or r.error_msg is not null)
    )
  ) into result;
  return result;
end
$$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- People: who they are, when they came, how active, and whether they are banned.
create function public.admin_users(search text default null)
returns table (
  id uuid, name text, email text, created_at timestamptz, last_seen_at timestamptz,
  connections bigint, plans bigint, reports bigint, banned boolean, is_admin boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return query
    select p.id, p.name, u.email::text, p.created_at, p.last_seen_at,
           (select count(*) from couple_members m where m.user_id = p.id),
           (select count(*) from events e where e.created_by = p.id),
           (select count(*) from reports r where r.reported = p.id),
           coalesce(u.banned_until > now(), false),
           exists (select 1 from admins a where a.user_id = p.id)
    from profiles p join auth.users u on u.id = p.id
    where search is null or search = ''
       or p.name ilike '%' || search || '%' or u.email ilike '%' || search || '%'
    order by p.created_at desc
    limit 200;
end
$$;
revoke execute on function public.admin_users(text) from public, anon;
grant execute on function public.admin_users(text) to authenticated;

-- Feedback and reports with the names (and emails, to reply) of the people involved.
create function public.admin_feedback()
returns table (id uuid, kind text, message text, device text, status text, created_at timestamptz,
               author uuid, author_name text, author_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return query
    select f.id, f.kind, f.message, f.device, f.status, f.created_at, f.author, p.name, u.email::text
    from feedback f left join profiles p on p.id = f.author left join auth.users u on u.id = f.author
    order by f.created_at desc
    limit 200;
end
$$;
revoke execute on function public.admin_feedback() from public, anon;
grant execute on function public.admin_feedback() to authenticated;

create function public.admin_reports()
returns table (id uuid, reason text, message text, status text, created_at timestamptz,
               reporter uuid, reporter_name text, reporter_email text,
               reported uuid, reported_name text, reported_email text, reported_banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return query
    select r.id, r.reason, r.message, r.status, r.created_at,
           r.reporter, a.name, au.email::text,
           r.reported, b.name, bu.email::text, coalesce(bu.banned_until > now(), false)
    from reports r
    left join profiles a on a.id = r.reporter left join auth.users au on au.id = r.reporter
    left join profiles b on b.id = r.reported left join auth.users bu on bu.id = r.reported
    order by r.created_at desc
    limit 200;
end
$$;
revoke execute on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;
