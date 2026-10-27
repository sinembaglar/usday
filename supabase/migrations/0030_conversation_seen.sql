-- "Görüldü" under my last comment: when each person last looked at a conversation. One row per
-- person and conversation: a plan's own ("plan"), or one about a plan on a shared calendar
-- ("<owner>:<viewer>"; the shared one is "<owner>:<owner>", like its comments). Only people who can
-- read the conversation can mark it or see who has seen it.

create table public.conversation_seen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  thread text not null default 'plan',
  owner uuid references auth.users on delete cascade,
  viewer uuid references auth.users on delete cascade,
  user_name text,
  seen_at timestamptz not null default now(),
  primary key (user_id, event_id, thread),
  check ((owner is null) = (viewer is null)),
  check (thread = coalesce(owner::text || ':' || viewer::text, 'plan'))
);
create index conversation_seen_event on public.conversation_seen (event_id);
alter table public.conversation_seen enable row level security;

-- Can I read this conversation? Runs with the caller's rights: the comment rules decide.
create function public.can_read_conversation(p_event uuid, p_owner uuid, p_viewer uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select case
    when p_owner is null then exists (select 1 from event_comments c where c.event_id = p_event)
    when p_viewer = p_owner then exists (
      select 1 from share_comments c where c.event_id = p_event and c.owner = p_owner and c.open
    )
    else exists (
      select 1 from share_comments c
      where c.event_id = p_event and c.owner = p_owner and c.viewer = p_viewer and not c.open
    )
  end
$$;
grant execute on function public.can_read_conversation(uuid, uuid, uuid) to authenticated;

create policy "seen in conversations I read" on public.conversation_seen
  for select to authenticated using (public.can_read_conversation(event_id, owner, viewer));
create policy "mark what I saw" on public.conversation_seen
  for insert to authenticated with check (
    user_id = auth.uid() and public.can_read_conversation(event_id, owner, viewer)
  );
create policy "mark it again" on public.conversation_seen
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and public.can_read_conversation(event_id, owner, viewer)
  );

-- The time is the database's, and the name comes along for people who are not connected.
create function public.fill_conversation_seen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.seen_at := now();
  new.user_name := (select name from profiles where id = new.user_id);
  return new;
end
$$;
create trigger conversation_seen_fill before insert or update on public.conversation_seen
  for each row execute function public.fill_conversation_seen();

alter publication supabase_realtime add table public.conversation_seen;
