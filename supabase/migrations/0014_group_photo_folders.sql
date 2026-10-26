-- Group plan photos get a folder of their own ("g-<plan id>"), readable only by the people on that plan.
-- (The maker's personal folder is visible to all of their connections, so it is not private enough.)

create or replace function public.can_see_folder(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text
      or folder in (select c::text from public.my_couples() c)
      or exists (
        select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
        where a.user_id = auth.uid() and b.user_id::text = folder
      )
      or (folder ~ '^g-[0-9a-f-]{36}$' and public.in_group_plan(substr(folder, 3)::uuid))
$$;

-- The maker uploads before the plan row exists (the app picks the plan id up front).
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
$$;

-- The maker must be able to read their group plan back while inserting it (in_group_plan cannot
-- see the row inside the same statement).
drop policy "read visible events" on public.events;
create policy "read visible events" on public.events
  for select to authenticated using (
    (couple_id is null and (created_by = auth.uid() or public.in_group_plan(id)))
    or (
      public.is_member(couple_id)
      and (created_by = auth.uid() or not surprise or reveal_on <= public.today_tr())
    )
  );
