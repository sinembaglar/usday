-- Everything the home screen needs, in one request instead of fourteen. It runs with the caller's own rights
-- (security invoker), so every access rule applies exactly as it does to the separate queries. Comments are
-- counted here instead of sending every comment row to count them in the app.

create function public.load_home() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'couples', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from (select id, cover_path, invite_code, together_since, relation, created_by, created_at from couples) c
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(p) - 'created_at' order by p.created_at)
      from (select id, name, color, last_seen_at, birthday, created_at from profiles) p
    ), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e)) from events e), '[]'::jsonb),
    'teasers', coalesce((select jsonb_agg(to_jsonb(t)) from surprise_teasers() t), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(to_jsonb(t) - 'created_at' order by t.created_at)
      from (select id, couple_id, tag, title, event_time, created_at from custom_templates) t
    ), '[]'::jsonb),
    'comment_counts', coalesce((
      select jsonb_object_agg(event_id, n) from (select event_id, count(*) n from event_comments group by event_id) x
    ), '{}'::jsonb),
    'unread', (select count(*) from notifications where read_at is null),
    'wishes', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from wishes w), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(to_jsonb(c)) from visible_claims() c), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('couple_id', m.couple_id, 'user_id', m.user_id)) from couple_members m), '[]'::jsonb),
    'teaser_couples', coalesce((select jsonb_agg(to_jsonb(t)) from surprise_teaser_connections() t), '[]'::jsonb),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', g.event_id, 'user_id', g.user_id, 'status', g.status, 'note', g.note,
                                          'suggested_date', g.suggested_date, 'suggested_time', g.suggested_time))
      from event_participants g
    ), '[]'::jsonb),
    'shared', coalesce((select jsonb_agg(to_jsonb(s)) from shared_calendar() s), '[]'::jsonb),
    'shares', coalesce((
      select jsonb_agg(jsonb_build_object('owner', s.owner, 'viewer', s.viewer, 'level', s.level)) from calendar_shares s
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.load_home() from public, anon;
grant execute on function public.load_home() to authenticated;
