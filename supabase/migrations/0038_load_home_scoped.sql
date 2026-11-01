-- The home load, scoped. Access rules still decide what a person may see, but a rule is checked row by row:
-- "select from events" asked the database to look at every plan of every person and drop the ones that are
-- not mine. As the app grows that gets slower for everyone. Now each part first narrows itself to my own
-- connections and group plans (using indexes), and the rules only check those rows. Same result, a fraction
-- of the work.

create or replace function public.load_home() returns jsonb
language sql stable security invoker set search_path = public as $$
  with me as (select auth.uid() as id),
  -- my connections (including invitations nobody has joined yet)
  mc as (select m.couple_id from couple_members m where m.user_id = (select id from me)),
  -- group plans I am invited to
  mg as (select p.event_id from event_participants p where p.user_id = (select id from me)),
  -- plans I may see: in my connections, or group plans I made or am invited to
  ev as (
    select e.* from events e
    where e.couple_id in (select couple_id from mc)
       or (e.couple_id is null and (e.created_by = (select id from me) or e.id in (select event_id from mg)))
  ),
  -- me and everyone I share a connection with
  circle as (
    select m.user_id as id from couple_members m where m.couple_id in (select couple_id from mc)
    union select id from me
  ),
  -- and the people on group plans with me
  people as (
    select id from circle
    union select p.user_id from event_participants p
          where p.event_id in (select id from ev where couple_id is null) or p.event_id in (select event_id from mg)
    union select e.created_by from events e where e.id in (select event_id from mg)
  )
  select jsonb_build_object(
    'couples', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from (select id, cover_path, invite_code, together_since, relation, created_by, created_at
            from couples where id in (select couple_id from mc)) c
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(p) - 'created_at' order by p.created_at)
      from (select id, name, color, last_seen_at, birthday, created_at from profiles where id in (select id from people)) p
    ), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e)) from ev e), '[]'::jsonb),
    'teasers', coalesce((select jsonb_agg(to_jsonb(t)) from surprise_teasers() t), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(to_jsonb(t) - 'created_at' order by t.created_at)
      from (select id, couple_id, tag, title, event_time, created_at from custom_templates
            where couple_id in (select couple_id from mc)) t
    ), '[]'::jsonb),
    'comment_counts', coalesce((
      select jsonb_object_agg(event_id, n)
      from (select event_id, count(*) n from event_comments where event_id in (select id from ev) group by event_id) x
    ), '{}'::jsonb),
    'unread', (select count(*) from notifications where recipient = (select id from me) and read_at is null),
    'wishes', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.created_at desc) from wishes w where w.owner in (select id from circle)
    ), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(to_jsonb(c)) from visible_claims() c), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('couple_id', m.couple_id, 'user_id', m.user_id))
      from couple_members m where m.couple_id in (select couple_id from mc)
    ), '[]'::jsonb),
    'teaser_couples', coalesce((select jsonb_agg(to_jsonb(t)) from surprise_teaser_connections() t), '[]'::jsonb),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', g.event_id, 'user_id', g.user_id, 'status', g.status, 'note', g.note,
                                          'suggested_date', g.suggested_date, 'suggested_time', g.suggested_time))
      from event_participants g
      where g.event_id in (select id from ev where couple_id is null) or g.user_id = (select id from me)
    ), '[]'::jsonb),
    'shared', coalesce((select jsonb_agg(to_jsonb(s)) from shared_calendar() s), '[]'::jsonb),
    'shares', coalesce((
      select jsonb_agg(jsonb_build_object('owner', s.owner, 'viewer', s.viewer, 'level', s.level))
      from calendar_shares s where s.owner = (select id from me) or s.viewer = (select id from me)
    ), '[]'::jsonb)
  )
$$;
