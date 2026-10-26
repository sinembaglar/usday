-- Plan proposals: ask the partner "are you free then?" before a plan is final.
-- A surprise can be proposed too; the partner only sees its teaser and time.

alter table public.events
  add column status text not null default 'confirmed' check (status in ('confirmed', 'proposed', 'declined')),
  add column awaiting uuid references public.profiles on delete set null,
  add column response_note text check (length(response_note) <= 300);

alter table public.events add constraint proposal_has_someone_to_answer
  check (status <> 'proposed' or awaiting is not null);

-- Only a partner in the same couple can be asked.
drop policy "add events" on public.events;
create policy "add events" on public.events
  for insert to authenticated with check (
    couple_id = public.my_couple_id()
    and created_by = auth.uid()
    and (
      awaiting is null
      or awaiting in (select id from public.profiles where couple_id = public.my_couple_id() and id <> auth.uid())
    )
  );

-- The asked person answers here, also for a surprise whose details they cannot see.
create function public.respond_to_plan(
  p_event uuid,
  p_answer text,
  p_date date default null,
  p_time time default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  e events;
  other uuid;
begin
  select * into e from events
  where id = p_event and couple_id = public.my_couple_id() and status = 'proposed' and awaiting = auth.uid();
  if not found then
    raise exception 'not_awaiting';
  end if;

  if p_answer = 'accept' then
    update events set status = 'confirmed', awaiting = null, response_note = nullif(trim(p_note), '') where id = p_event;
  elsif p_answer = 'decline' then
    update events set status = 'declined', awaiting = null, response_note = nullif(trim(p_note), '') where id = p_event;
  elsif p_answer = 'counter' and p_date is not null then
    select id into other from profiles where couple_id = e.couple_id and id <> auth.uid() limit 1;
    update events set
      event_date = p_date,
      event_time = p_time,
      end_time = case when p_time is not null and end_time > p_time then end_time end,
      reveal_on = case when surprise then least(coalesce(reveal_on, p_date), p_date) end,
      awaiting = other,
      response_note = nullif(trim(p_note), '')
    where id = p_event;
  else
    raise exception 'bad_answer';
  end if;
end
$$;

revoke execute on function public.respond_to_plan(uuid, text, date, time, text) from public, anon;
grant execute on function public.respond_to_plan(uuid, text, date, time, text) to authenticated;

-- Teasers now say whether the surprise is still a question for the partner.
drop function public.surprise_teasers();

create function public.surprise_teasers()
returns table (
  id uuid,
  event_date date,
  event_time time,
  teaser text,
  reveal_on date,
  created_by uuid,
  created_at timestamptz,
  photo_count int,
  photos text[],
  status text,
  awaiting uuid,
  response_note text
)
language sql stable security definer set search_path = public as $$
  select e.id, e.event_date, e.event_time, e.teaser, e.reveal_on, e.created_by, e.created_at,
         coalesce(array_length(e.photos, 1), 0),
         case when e.blur_photos then '{}'::text[] else e.photos end,
         e.status, e.awaiting, e.response_note
  from events e
  where e.couple_id = public.my_couple_id()
    and e.surprise
    and e.created_by <> auth.uid()
    and e.reveal_on > public.today_tr()
$$;

revoke execute on function public.surprise_teasers() from public, anon;
grant execute on function public.surprise_teasers() to authenticated;
