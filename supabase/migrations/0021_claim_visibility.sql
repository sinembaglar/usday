-- The claimer chooses whether others see their name ("Yaren alıyor") or only that someone is
-- getting it ("Biri alıyor"). Either way the wish is taken, so it is not bought twice, and the
-- wish owner never sees anything.

alter table public.wish_claims add column shared boolean not null default true;

drop function public.visible_claims();
create function public.visible_claims()
returns table (wish_id uuid, claimed_by uuid, claimer_name text, has_plan boolean, shared boolean)
language sql stable security definer set search_path = public as $$
  select c.wish_id,
         case when c.shared or c.claimed_by = auth.uid() then c.claimed_by end,
         case when c.shared or c.claimed_by = auth.uid() then p.name end,
         case when c.claimed_by = auth.uid() then c.plan_id is not null else c.shared and c.plan_id is not null end,
         c.shared
  from wish_claims c
  join wishes w on w.id = c.wish_id
  join profiles p on p.id = c.claimed_by
  where w.owner <> auth.uid() and (public.connected(w.owner) or c.claimed_by = auth.uid())
$$;
revoke execute on function public.visible_claims() from public, anon;
grant execute on function public.visible_claims() to authenticated;

-- The table itself only shows the claimer their own claims; others go through visible_claims().
drop policy "claims on wishes I can see" on public.wish_claims;
create policy "claims on wishes I can see" on public.wish_claims
  for select to authenticated using (
    claimed_by = auth.uid()
    or exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.owner <> auth.uid() and public.connected(w.owner)
    ) and shared
  );
