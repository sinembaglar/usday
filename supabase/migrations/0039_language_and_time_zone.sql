-- Each person's language and time zone, so notifications, reminders, the calendar feed and e-mails speak
-- their language and follow their clock. The app keeps both up to date from the phone; sign-up sends them.
alter table public.profiles
  add column lang text not null default 'tr' check (lang in ('tr', 'en')),
  add column time_zone text not null default 'Europe/Istanbul' check (time_zone ~ '^[A-Za-z0-9_+/-]{1,64}$');

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.open_couple(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  joining boolean := cid is not null;
  born date;
  speaks text := case when new.raw_user_meta_data ->> 'lang' = 'en' then 'en' else 'tr' end;
  zone text := coalesce(nullif(new.raw_user_meta_data ->> 'time_zone', ''), 'Europe/Istanbul');
begin
  begin
    born := nullif(new.raw_user_meta_data ->> 'birthday', '')::date;
    if extract(year from born) <> 2000 then born := null; end if;
  exception when others then
    born := null;
  end;
  if zone !~ '^[A-Za-z0-9_+/-]{1,64}$' or not exists (select 1 from pg_timezone_names where name = zone) then
    zone := 'Europe/Istanbul';
  end if;
  insert into profiles (id, name, color, birthday, lang, time_zone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when joining then '#8AA0C9' else '#C58FB8' end,
    born,
    speaks,
    zone
  );
  if not joining then
    insert into couples (created_by) values (new.id) returning id into cid;
  end if;
  insert into couple_members (couple_id, user_id) values (cid, new.id);
  return new;
end
$$;
