-- Shared wish claims: when someone says "bunu ben alıyorum", everyone else who can see the wish
-- sees who is getting it, so the same gift is not bought twice. The wish owner still never sees it.

create policy "claims on wishes I can see" on public.wish_claims
  for select to authenticated using (
    exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.owner <> auth.uid() and public.connected(w.owner)
    )
  );

-- Claims on others' wishes I can see, with the claimer's name (they may not be connected to me).
create function public.visible_claims()
returns table (wish_id uuid, claimed_by uuid, claimer_name text, has_plan boolean)
language sql stable security definer set search_path = public as $$
  select c.wish_id, c.claimed_by, p.name, c.plan_id is not null
  from wish_claims c
  join wishes w on w.id = c.wish_id
  join profiles p on p.id = c.claimed_by
  where w.owner <> auth.uid() and (public.connected(w.owner) or c.claimed_by = auth.uid())
$$;
revoke execute on function public.visible_claims() from public, anon;
grant execute on function public.visible_claims() to authenticated;

alter publication supabase_realtime add table public.wish_claims;
