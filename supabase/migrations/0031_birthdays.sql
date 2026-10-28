-- Everyone's birthday (day and month only; the year is always 2000, so age is never stored and
-- 29 February is a valid date). The people someone is connected to see it on their calendars and
-- are reminded from a month before; the birthday person is never told about these reminders.

alter table public.profiles add column birthday date;
alter table public.profiles add constraint profiles_birthday_no_year check (
  birthday is null or extract(year from birthday) = 2000
);

-- Birthday reminders already sent: one per person, recipient and step (e.g. "30:2026").
create table public.sent_birthdays (
  person_id uuid not null references public.profiles on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (person_id, user_id, key)
);
alter table public.sent_birthdays enable row level security; -- only the reminders function writes it

-- New account: the birthday chosen at sign-up comes along (ignored if it is not a valid day).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.open_couple(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  joining boolean := cid is not null;
  born date;
begin
  begin
    born := nullif(new.raw_user_meta_data ->> 'birthday', '')::date;
    if extract(year from born) <> 2000 then born := null; end if;
  exception when others then
    born := null;
  end;
  insert into profiles (id, name, color, birthday)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when joining then '#8AA0C9' else '#C58FB8' end,
    born
  );
  if not joining then
    insert into couples (created_by) values (new.id) returning id into cid;
  end if;
  insert into couple_members (couple_id, user_id) values (cid, new.id);
  return new;
end
$$;
