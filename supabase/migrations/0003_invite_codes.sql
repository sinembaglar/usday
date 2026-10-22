-- Pair partners with an invite code instead of "first couple with room".

create function public.new_invite_code() returns text
language sql volatile as $$
  -- no 0/O/1/I to keep codes easy to read aloud
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
  from generate_series(1, 6)
$$;

alter table public.couples add column invite_code text unique default public.new_invite_code();
update public.couples set invite_code = public.new_invite_code() where invite_code is null;
alter table public.couples alter column invite_code set not null;

-- The couple behind a code, if it still has room for a partner.
create function public.open_couple(code text) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from couples c
  where c.invite_code = upper(trim(code))
    and (select count(*) from profiles p where p.couple_id = c.id) < 2
$$;

-- Lets the sign-up screen greet the invited partner by name.
create function public.check_invite(code text) returns text
language sql stable security definer set search_path = public as $$
  select p.name from profiles p where p.couple_id = public.open_couple(code) limit 1
$$;

revoke execute on function public.open_couple(text) from public, anon, authenticated;
grant execute on function public.check_invite(text) to anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.open_couple(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  members int;
begin
  if cid is null then
    insert into couples default values returning id into cid;
  end if;

  select count(*) into members from profiles where couple_id = cid;

  insert into profiles (id, couple_id, name, color)
  values (
    new.id,
    cid,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when members = 0 then '#C58FB8' else '#8AA0C9' end
  );
  return new;
end
$$;

-- For someone who signed up without the code: move into the partner's
-- calendar, as long as nothing was added to the empty one yet.
create function public.join_couple(code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  target uuid := public.open_couple(code);
  current_couple uuid := public.my_couple_id();
begin
  if target is null or target = current_couple then
    raise exception 'invalid_invite';
  end if;
  if (select count(*) from profiles where couple_id = current_couple) > 1
     or exists (select 1 from events where couple_id = current_couple) then
    raise exception 'calendar_not_empty';
  end if;

  update profiles
  set couple_id = target,
      color = case when (select count(*) from profiles where couple_id = target) = 0 then '#C58FB8' else '#8AA0C9' end
  where id = auth.uid();
  delete from couples where id = current_couple;
end
$$;

revoke execute on function public.join_couple(text) from public, anon;
grant execute on function public.join_couple(text) to authenticated;
