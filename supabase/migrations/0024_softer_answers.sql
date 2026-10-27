-- Softer answers to a group plan: besides "katılıyorum" and "katılamıyorum", a guest can say
-- "belki" or suggest another time. The plan's maker can move the plan to a suggested time;
-- everyone is then asked again (the guest who suggested it counts as coming).

alter table public.event_participants drop constraint event_participants_status_check;
alter table public.event_participants add constraint event_participants_status_check
  check (status in ('pending', 'accepted', 'maybe', 'suggested', 'declined'));
alter table public.event_participants add column suggested_date date;
alter table public.event_participants add column suggested_time time;

drop function public.answer_invitation(uuid, text, text);
create function public.answer_invitation(
  p_event uuid, p_status text, p_note text default null, p_date date default null, p_time time default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('accepted', 'maybe', 'suggested', 'declined') then
    raise exception 'bad_answer';
  end if;
  if p_status = 'suggested' and p_date is null then
    raise exception 'no_suggested_time';
  end if;
  update event_participants
  set status = p_status,
      note = nullif(trim(p_note), ''),
      suggested_date = case when p_status = 'suggested' then p_date end,
      suggested_time = case when p_status = 'suggested' then p_time end,
      responded_at = now()
  where event_id = p_event and user_id = auth.uid();
  if not found then
    raise exception 'not_invited';
  end if;
end
$$;
revoke execute on function public.answer_invitation(uuid, text, text, date, time) from public, anon;
grant execute on function public.answer_invitation(uuid, text, text, date, time) to authenticated;

-- The maker moves a group plan to a new time (often one a guest suggested). The plan keeps its
-- length; everyone is asked again, except the guest whose suggestion it was.
create function public.move_group_plan(p_event uuid, p_date date, p_time time default null, p_from uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e events;
begin
  select * into e from events where id = p_event and couple_id is null and created_by = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  update events set
    event_date = p_date,
    event_time = p_time,
    end_time = case
      when p_time is not null and e.event_time is not null and e.end_time is not null
        then (p_time + (e.end_time - e.event_time))::time
    end,
    reveal_on = case when e.surprise then least(coalesce(e.reveal_on, e.event_date), p_date) end
  where id = p_event; -- the reset_reminders trigger sends reminders again for the new time
  update event_participants
  set status = case when user_id = p_from then 'accepted' else 'pending' end,
      suggested_date = null, suggested_time = null,
      note = case when user_id = p_from then note end,
      responded_at = case when user_id = p_from then now() end
  where event_id = p_event;
end
$$;
revoke execute on function public.move_group_plan(uuid, date, time, uuid) from public, anon;
grant execute on function public.move_group_plan(uuid, date, time, uuid) to authenticated;
