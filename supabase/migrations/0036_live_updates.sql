-- Live updates through one private channel per person ("user:<id>"). Until now every open app listened to
-- every change in plans, wishes and shares, and the server checked each change against each open app.
-- Now a change pings only the people it concerns, and the app reloads what it shows. The ping carries
-- nothing ("changed"), so it cannot give away a surprise or a claimed wish.

create function public.ping(people uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  person uuid;
begin
  for person in select distinct p from unnest(people) p where p is not null loop
    begin
      perform realtime.send('{}'::jsonb, 'changed', 'user:' || person::text, true);
    exception when others then
      null; -- a missed live update must never stop a save
    end;
  end loop;
end
$$;

-- Everyone a person shares a connection with, and the person.
create function public.circle(person uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_append(array(
    select o.user_id from couple_members m join couple_members o on o.couple_id = m.couple_id
    where m.user_id = person
  ), person)
$$;

-- A plan: its two people or its guests, and whoever sees their calendars.
create function public.ping_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e events;
  people uuid[];
begin
  if tg_op = 'DELETE' then e := old; else e := new; end if;
  people := array(
    select e.created_by
    union select m.user_id from couple_members m where m.couple_id = e.couple_id
    union select p.user_id from event_participants p where p.event_id = e.id
  );
  people := people || array(select s.viewer from calendar_shares s where s.owner = any(people));
  perform public.ping(people);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
-- Deletes are announced before the row goes, while its guests are still listed.
create trigger events_ping after insert or update on public.events
  for each row execute function public.ping_event();
create trigger events_ping_delete before delete on public.events
  for each row execute function public.ping_event();

create function public.ping_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p event_participants;
begin
  if tg_op = 'DELETE' then p := old; else p := new; end if;
  perform public.ping(array(
    select p.user_id
    union select e.created_by from events e where e.id = p.event_id
    union select x.user_id from event_participants x where x.event_id = p.event_id
  ));
  return null;
end
$$;
create trigger event_participants_ping after insert or update or delete on public.event_participants
  for each row execute function public.ping_participant();

create function public.ping_wish() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ping(public.circle(coalesce(new.owner, old.owner)));
  return null;
end
$$;
create trigger wishes_ping after insert or update or delete on public.wishes
  for each row execute function public.ping_wish();

-- A claim is never announced to the wish's owner.
create function public.ping_claim() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := (select w.owner from wishes w where w.id = coalesce(new.wish_id, old.wish_id));
begin
  perform public.ping(array_remove(public.circle(coalesce(owner_id, coalesce(new.claimed_by, old.claimed_by))), owner_id));
  return null;
end
$$;
create trigger wish_claims_ping after insert or update or delete on public.wish_claims
  for each row execute function public.ping_claim();

create function public.ping_share() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ping(array[coalesce(new.owner, old.owner), coalesce(new.viewer, old.viewer)]);
  return null;
end
$$;
create trigger calendar_shares_ping after insert or update or delete on public.calendar_shares
  for each row execute function public.ping_share();

create function public.ping_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ping(array[new.recipient]);
  return null;
end
$$;
create trigger notifications_ping after insert on public.notifications
  for each row execute function public.ping_notification();

-- Only the person can listen to their own channel.
create policy "a person hears their own channel" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'user:' || (select auth.uid())::text);

revoke execute on function public.ping(uuid[]) from public, anon, authenticated;
revoke execute on function public.circle(uuid) from public, anon, authenticated;
revoke execute on function public.ping_event() from public, anon, authenticated;
revoke execute on function public.ping_participant() from public, anon, authenticated;
revoke execute on function public.ping_wish() from public, anon, authenticated;
revoke execute on function public.ping_claim() from public, anon, authenticated;
revoke execute on function public.ping_share() from public, anon, authenticated;
revoke execute on function public.ping_notification() from public, anon, authenticated;
