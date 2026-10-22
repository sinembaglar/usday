-- Blurred surprise photos must not be downloadable by the partner,
-- even by listing the couple folder or guessing the file name.

create function public.is_hidden_photo(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.couple_id = public.my_couple_id()
      and e.surprise
      and e.blur_photos
      and e.created_by <> auth.uid()
      and e.reveal_on > public.today_tr()
      and object_name = any (e.photos)
  )
$$;

drop policy "couple photos read" on storage.objects;

create policy "couple photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.my_couple_id()::text
    and not public.is_hidden_photo(name)
  );
