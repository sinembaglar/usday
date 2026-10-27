-- Can this person get phone notifications? Shown in a conversation so the writer knows when
-- the other side will only see a comment the next time they open the app.
create function public.has_push(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (person = auth.uid() or public.connected(person))
     and exists (select 1 from push_subscriptions where user_id = person)
$$;
revoke execute on function public.has_push(uuid) from public, anon;
grant execute on function public.has_push(uuid) to authenticated;
