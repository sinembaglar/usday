-- Talking about a plan on a shared calendar is one conversation for everyone the calendar is shared
-- with by plan name: they all read it and can join in. Someone who only sees busy/free time does not
-- know the plan's name, which the conversation would give away, so their words stay between them and
-- the owner, as before. A surprise only ever shows as busy time, so its comments stay private too.
--
-- A comment is "open" when it belongs to the shared conversation. The database decides it:
--   the viewer writes:          open when they see plan names and the plan is not a surprise
--   the owner writes (viewer = owner): an answer in the shared conversation, always open
--   the owner writes to a viewer: a private answer, never open

alter table public.share_comments add column open boolean not null default false;
-- Others in the shared conversation may not be connected to the writer, so the name comes along.
alter table public.share_comments add column author_name text;

create function public.share_comment_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := (select name from profiles where id = new.author);
  new.open := case
    when new.viewer = new.owner then true
    when new.author = new.owner then false
    else exists (
      select 1 from calendar_shares s join events e on e.id = new.event_id
      where s.owner = new.owner and s.viewer = new.viewer and s.level = 'details' and not e.surprise
    )
  end;
  return new;
end
$$;

create trigger share_comments_open
  before insert on public.share_comments
  for each row execute function public.share_comment_open();

-- What was already written by people who see plan names joins the shared conversation.
update public.share_comments c set open = true
from public.calendar_shares s, public.events e
where s.owner = c.owner and s.viewer = c.viewer and s.level = 'details'
  and e.id = c.event_id and not e.surprise and c.author = c.viewer;
update public.share_comments c set author_name = p.name from public.profiles p where p.id = c.author;

drop policy "my side conversations" on public.share_comments;
create policy "my side conversations and the shared one" on public.share_comments
  for select to authenticated using (
    auth.uid() = owner
    or auth.uid() = viewer
    or (
      open
      and exists (
        select 1 from public.calendar_shares s
        where s.owner = share_comments.owner and s.viewer = auth.uid() and s.level = 'details'
      )
      and public.on_calendar_of(event_id, owner)
    )
  );

drop policy "talk about a shared plan" on public.share_comments;
create policy "talk about a shared plan" on public.share_comments
  for insert to authenticated with check (
    author = auth.uid()
    and public.on_calendar_of(event_id, owner)
    and (
      -- a viewer, while the owner shares their calendar with them
      (auth.uid() = viewer and auth.uid() <> owner and exists (
        select 1 from public.calendar_shares s where s.owner = share_comments.owner and s.viewer = auth.uid()
      ))
      -- the owner, answering someone who wrote to them about this plan
      or (auth.uid() = owner and viewer <> owner and exists (
        select 1 from public.share_comments c
        where c.event_id = share_comments.event_id and c.owner = auth.uid() and c.viewer = share_comments.viewer
      ))
      -- the owner, answering in the shared conversation once someone has started it
      or (auth.uid() = owner and viewer = owner and exists (
        select 1 from public.share_comments c
        where c.event_id = share_comments.event_id and c.owner = auth.uid() and c.open
      ))
    )
  );

-- Pictures in the shared conversation: whoever can read the comment can see its picture.
-- Runs with the caller's rights, so it is exactly the comment rule above.
create function public.can_see_share_image(path text) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from share_comments c where c.image_path = path)
$$;
grant execute on function public.can_see_share_image(text) to authenticated;

create policy "shared calendar comment pictures read" on storage.objects
  for select to authenticated using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] ~ '^s-[0-9a-f-]{36}-[0-9a-f-]{36}$'
    and public.can_see_share_image(name)
  );
