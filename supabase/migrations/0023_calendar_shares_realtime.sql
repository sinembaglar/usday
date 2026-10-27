-- The app reloads when someone starts or stops sharing their calendar with me.
alter publication supabase_realtime add table public.calendar_shares;
