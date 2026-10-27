-- An emoji on a single comment ("😂" when it is funny), in plan conversations and in conversations
-- about a plan on a shared calendar. Whoever can read the comment can react, one emoji each; the
-- comment's author hears about it. event_id comes from the comment, so the app can follow a whole
-- conversation's reactions at once; the name comes along for people who are not connected.

create function public.fill_comment_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.event_id := case tg_table_name
    when 'comment_reactions' then (select event_id from event_comments where id = new.comment_id)
    else (select event_id from share_comments where id = new.comment_id)
  end;
  new.user_name := (select name from profiles where id = new.user_id);
  return new;
end
$$;

-- Sent by the database, like comments; the notify function tells the comment's author.
create function public.notify_comment_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://uywvqxxjsbnwspdxwnhl.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'usday_cron_secret')
    ),
    body := jsonb_build_object(
      'comment_reaction', jsonb_build_object(
        'kind', case tg_table_name when 'comment_reactions' then 'event' else 'share' end,
        'comment_id', new.comment_id,
        'user_id', new.user_id,
        'emoji', new.emoji
      )
    ),
    timeout_milliseconds := 10000
  );
  return new;
end
$$;

create table public.comment_reactions (
  comment_id uuid not null references public.event_comments on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null,
  user_name text,
  emoji text not null check (emoji in ('😂', '😍', '😮', '😢', '😡', '👍')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_reactions_event on public.comment_reactions (event_id);

create table public.share_comment_reactions (
  comment_id uuid not null references public.share_comments on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null,
  user_name text,
  emoji text not null check (emoji in ('😂', '😍', '😮', '😢', '😡', '👍')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index share_comment_reactions_event on public.share_comment_reactions (event_id);

alter table public.comment_reactions enable row level security;
alter table public.share_comment_reactions enable row level security;

-- The comment rules decide: these look at the comment as the caller sees it.
create policy "read reactions on comments I see" on public.comment_reactions
  for select to authenticated using (exists (select 1 from public.event_comments c where c.id = comment_id));
create policy "react to comments I see" on public.comment_reactions
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.event_comments c where c.id = comment_id)
  );
create policy "change my reaction" on public.comment_reactions
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (select 1 from public.event_comments c where c.id = comment_id)
  );
create policy "take back my reaction" on public.comment_reactions
  for delete to authenticated using (user_id = auth.uid());

create policy "read reactions on comments I see" on public.share_comment_reactions
  for select to authenticated using (exists (select 1 from public.share_comments c where c.id = comment_id));
create policy "react to comments I see" on public.share_comment_reactions
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.share_comments c where c.id = comment_id)
  );
create policy "change my reaction" on public.share_comment_reactions
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (select 1 from public.share_comments c where c.id = comment_id)
  );
create policy "take back my reaction" on public.share_comment_reactions
  for delete to authenticated using (user_id = auth.uid());

create trigger comment_reactions_fill before insert or update on public.comment_reactions
  for each row execute function public.fill_comment_reaction();
create trigger share_comment_reactions_fill before insert or update on public.share_comment_reactions
  for each row execute function public.fill_comment_reaction();
create trigger comment_reactions_notify after insert or update of emoji on public.comment_reactions
  for each row execute function public.notify_comment_reaction();
create trigger share_comment_reactions_notify after insert or update of emoji on public.share_comment_reactions
  for each row execute function public.notify_comment_reaction();

alter publication supabase_realtime add table public.comment_reactions, public.share_comment_reactions;
