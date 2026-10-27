-- The insert rule looked at share_comments itself, which Postgres treats as recursion once the read
-- rule became richer. The "has someone already written" checks move into functions.

create function public.share_thread_started(p_event uuid, p_owner uuid, p_viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from share_comments c
    where c.event_id = p_event and c.owner = p_owner
      and (case when p_viewer = p_owner then c.open else c.viewer = p_viewer end)
  )
$$;
revoke execute on function public.share_thread_started(uuid, uuid, uuid) from public, anon;
grant execute on function public.share_thread_started(uuid, uuid, uuid) to authenticated;

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
      -- the owner, answering someone who wrote to them about this plan (viewer = that person), or in
      -- the shared conversation once someone has started it (viewer = the owner)
      or (auth.uid() = owner and public.share_thread_started(event_id, owner, viewer))
    )
  );
