-- Pictures and GIFs in comments. Each kind of conversation keeps its pictures in its own folder,
-- readable by exactly the people who can read that conversation:
--   c-<plan id>/...            a plan's comments (so a surprise's target never sees the planning)
--   s-<owner>-<viewer>/...     a side conversation about a plan on a shared calendar

alter table public.event_comments add column image_path text;
alter table public.event_comments drop constraint event_comments_body_check;
alter table public.event_comments add constraint event_comments_body_check check (
  length(trim(body)) <= 1000 and (length(trim(body)) >= 1 or image_path is not null)
);
alter table public.event_comments add constraint event_comments_image_folder check (
  image_path is null or image_path like 'c-' || event_id || '/%'
);

alter table public.share_comments add column image_path text;
alter table public.share_comments drop constraint share_comments_body_check;
alter table public.share_comments add constraint share_comments_body_check check (
  length(trim(body)) <= 1000 and (length(trim(body)) >= 1 or image_path is not null)
);
alter table public.share_comments add constraint share_comments_image_folder check (
  image_path is null or image_path like 's-' || owner || '-' || viewer || '/%'
);

-- Can I read this plan's comments? Runs with the caller's rights, so it is exactly the rule the
-- comments themselves follow (the plan must be visible to me).
create function public.can_see_plan_comments(p_event uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event)
$$;
grant execute on function public.can_see_plan_comments(uuid) to authenticated;

create or replace function public.can_see_folder(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text
      or folder in (select c::text from public.my_couples() c)
      or exists (
        select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
        where a.user_id = auth.uid() and b.user_id::text = folder
      )
      or (folder ~ '^g-[0-9a-f-]{36}$' and public.in_group_plan(substr(folder, 3)::uuid))
      or (folder ~ '^s-[0-9a-f-]{36}-[0-9a-f-]{36}$'
          and auth.uid()::text in (substr(folder, 3, 36), substr(folder, 40, 36)))
$$;

create or replace function public.can_write_folder(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text
      or folder in (select c::text from public.my_couples() c)
      or (
        folder ~ '^g-[0-9a-f-]{36}$'
        and not exists (
          select 1 from events e where e.id = substr(folder, 3)::uuid and e.created_by <> auth.uid()
        )
      )
      or (folder ~ '^s-[0-9a-f-]{36}-[0-9a-f-]{36}$'
          and auth.uid()::text in (substr(folder, 3, 36), substr(folder, 40, 36)))
$$;

-- Plan comment pictures: the plan's comment rule, checked as the caller (not inside the definer
-- functions above, which cannot see the caller's view of the plan).
create policy "comment pictures read" on storage.objects
  for select to authenticated using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] ~ '^c-[0-9a-f-]{36}$'
    and public.can_see_plan_comments(substr((storage.foldername(name))[1], 3)::uuid)
  );
create policy "comment pictures upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] ~ '^c-[0-9a-f-]{36}$'
    and public.can_see_plan_comments(substr((storage.foldername(name))[1], 3)::uuid)
  );
create policy "comment pictures delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'photos' and (storage.foldername(name))[1] ~ '^c-[0-9a-f-]{36}$' and owner = auth.uid()
  );
