-- Performance and hygiene before launch (Supabase's own database checks).
--
-- 1. Access rules read the signed-in person once per query instead of once per row:
--    auth.uid() becomes (select auth.uid()). The rules themselves do not change.
alter policy "my blocks" on public.blocks using ((blocker = (select auth.uid())));
alter policy unblock on public.blocks using ((blocker = (select auth.uid())));
alter policy "change my shares" on public.calendar_shares using ((owner = (select auth.uid()))) with check (((owner = (select auth.uid())) AND connected(viewer)));
alter policy "my shares" on public.calendar_shares using (((owner = (select auth.uid())) OR (viewer = (select auth.uid()))));
alter policy "share with someone I know" on public.calendar_shares with check (((owner = (select auth.uid())) AND connected(viewer)));
alter policy "stop sharing" on public.calendar_shares using ((owner = (select auth.uid())));
alter policy "change my reaction" on public.comment_reactions using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM event_comments c
  WHERE (c.id = comment_reactions.comment_id)))));
alter policy "react to comments I see" on public.comment_reactions with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM event_comments c
  WHERE (c.id = comment_reactions.comment_id)))));
alter policy "take back my reaction" on public.comment_reactions using ((user_id = (select auth.uid())));
alter policy "mark it again" on public.conversation_seen using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND can_read_conversation(event_id, owner, viewer)));
alter policy "mark what I saw" on public.conversation_seen with check (((user_id = (select auth.uid())) AND can_read_conversation(event_id, owner, viewer)));
alter policy "cover my own connections" on public.covered_connections with check (((payer = (select auth.uid())) AND is_member(couple_id)));
alter policy "see who pays for my connections" on public.covered_connections using (((payer = (select auth.uid())) OR is_member(couple_id)));
alter policy "stop covering" on public.covered_connections using ((payer = (select auth.uid())));
alter policy "add connection templates" on public.custom_templates with check ((is_member(couple_id) AND (created_by = (select auth.uid()))));
alter policy "comment on visible plans" on public.event_comments with check (((author = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM events e
  WHERE (e.id = event_comments.event_id)))));
alter policy "delete own comments" on public.event_comments using ((author = (select auth.uid())));
alter policy "invite to my group plan" on public.event_participants with check (((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_participants.event_id) AND (e.couple_id IS NULL) AND (e.created_by = (select auth.uid()))))) AND ((user_id = (select auth.uid())) OR connected(user_id))));
alter policy "people on my group plans" on public.event_participants using ((in_group_plan(event_id) AND ((user_id = (select auth.uid())) OR (NOT secret_for_me(event_id)))));
alter policy "uninvite from my group plan" on public.event_participants using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_participants.event_id) AND (e.created_by = (select auth.uid()))))));
alter policy "change own reaction" on public.event_reactions using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "react to visible plans" on public.event_reactions with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM events e
  WHERE (e.id = event_reactions.event_id)))));
alter policy "remove own reaction" on public.event_reactions using ((user_id = (select auth.uid())));
alter policy "add events" on public.events with check (((created_by = (select auth.uid())) AND (((couple_id IS NULL) AND (awaiting IS NULL) AND ((NOT surprise) OR (COALESCE(cardinality(hidden_from), 0) > 0))) OR (is_member(couple_id) AND ((awaiting IS NULL) OR ((awaiting <> (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM couple_members m
  WHERE ((m.couple_id = events.couple_id) AND (m.user_id = events.awaiting))))))))));
alter policy "delete events" on public.events using ((((couple_id IS NULL) AND (created_by = (select auth.uid()))) OR (is_member(couple_id) AND ((created_by = (select auth.uid())) OR (NOT surprise)))));
alter policy "edit events" on public.events using ((((couple_id IS NULL) AND (created_by = (select auth.uid()))) OR (is_member(couple_id) AND ((created_by = (select auth.uid())) OR (NOT surprise)))));
alter policy "read visible events" on public.events using ((((couple_id IS NULL) AND ((created_by = (select auth.uid())) OR (in_group_plan(id) AND (NOT secret_for_me(id))))) OR (is_member(couple_id) AND ((created_by = (select auth.uid())) OR (NOT surprise) OR (reveal_on <= today_tr())))));
alter policy "send feedback" on public.feedback with check (((author = (select auth.uid())) AND (status = 'new'::text)));
alter policy "clear own notifications" on public.notifications using ((recipient = (select auth.uid())));
alter policy "own notifications" on public.notifications using ((recipient = (select auth.uid())));
alter policy "me, connected and co-invited people" on public.profiles using (((id = (select auth.uid())) OR connected(id) OR plans_with(id)));
alter policy "update own profile" on public.profiles using ((id = (select auth.uid())));
alter policy "own subscriptions" on public.push_subscriptions using ((user_id = (select auth.uid())));
alter policy "remove own subscriptions" on public.push_subscriptions using ((user_id = (select auth.uid())));
alter policy "report someone I know" on public.reports with check (((reporter = (select auth.uid())) AND (reported <> (select auth.uid())) AND (status = 'new'::text) AND (connected(reported) OR plans_with(reported))));
alter policy "change my reaction" on public.share_comment_reactions using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM share_comments c
  WHERE (c.id = share_comment_reactions.comment_id)))));
alter policy "react to comments I see" on public.share_comment_reactions with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM share_comments c
  WHERE (c.id = share_comment_reactions.comment_id)))));
alter policy "take back my reaction" on public.share_comment_reactions using ((user_id = (select auth.uid())));
alter policy "delete what I wrote" on public.share_comments using ((author = (select auth.uid())));
alter policy "my side conversations and the shared one" on public.share_comments using ((((select auth.uid()) = owner) OR ((select auth.uid()) = viewer) OR (open AND (EXISTS ( SELECT 1
   FROM calendar_shares s
  WHERE ((s.owner = share_comments.owner) AND (s.viewer = (select auth.uid())) AND (s.level = 'details'::text)))) AND on_calendar_of(event_id, owner))));
alter policy "talk about a shared plan" on public.share_comments with check (((author = (select auth.uid())) AND on_calendar_of(event_id, owner) AND ((((select auth.uid()) = viewer) AND ((select auth.uid()) <> owner) AND (EXISTS ( SELECT 1
   FROM calendar_shares s
  WHERE ((s.owner = share_comments.owner) AND (s.viewer = (select auth.uid())))))) OR (((select auth.uid()) = owner) AND share_thread_started(event_id, owner, viewer)))));
alter policy "my subscription" on public.subscriptions using ((user_id = (select auth.uid())));
alter policy "claim connected wish" on public.wish_claims with check (((claimed_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM wishes w
  WHERE ((w.id = wish_claims.wish_id) AND (w.owner <> (select auth.uid())) AND connected(w.owner) AND (w.status = 'open'::text))))));
alter policy "claims on wishes I can see" on public.wish_claims using (((claimed_by = (select auth.uid())) OR ((EXISTS ( SELECT 1
   FROM wishes w
  WHERE ((w.id = wish_claims.wish_id) AND (w.owner <> (select auth.uid())) AND connected(w.owner)))) AND shared)));
alter policy "drop my claims" on public.wish_claims using ((claimed_by = (select auth.uid())));
alter policy "my claims" on public.wish_claims using ((claimed_by = (select auth.uid())));
alter policy "update my claims" on public.wish_claims using ((claimed_by = (select auth.uid()))) with check ((claimed_by = (select auth.uid())));
alter policy "add own wishes" on public.wishes with check ((owner = (select auth.uid())));
alter policy "delete own wishes" on public.wishes using ((owner = (select auth.uid())));
alter policy "edit own wishes" on public.wishes using ((owner = (select auth.uid()))) with check ((owner = (select auth.uid())));
alter policy "my and connected wishes" on public.wishes using (((owner = (select auth.uid())) OR connected(owner)));
alter policy "comment pictures delete own" on storage.objects using (((bucket_id = 'photos'::text) AND ((storage.foldername(name))[1] ~ '^c-[0-9a-f-]{36}$'::text) AND (owner = (select auth.uid()))));

-- 2. Indexes for foreign keys, so lookups and deletes by person or plan do not scan whole tables.
create index if not exists blocks_blocked_idx on public.blocks (blocked);
create index if not exists calendar_shares_viewer_idx on public.calendar_shares (viewer);
create index if not exists comment_reactions_user_id_idx on public.comment_reactions (user_id);
create index if not exists conversation_seen_owner_idx on public.conversation_seen (owner);
create index if not exists conversation_seen_viewer_idx on public.conversation_seen (viewer);
create index if not exists couples_created_by_idx on public.couples (created_by);
create index if not exists covered_connections_couple_id_idx on public.covered_connections (couple_id);
create index if not exists custom_templates_created_by_idx on public.custom_templates (created_by);
create index if not exists event_comments_author_idx on public.event_comments (author);
create index if not exists event_reactions_user_id_idx on public.event_reactions (user_id);
create index if not exists events_awaiting_idx on public.events (awaiting);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists feedback_author_idx on public.feedback (author);
create index if not exists moderation_log_admin_idx on public.moderation_log (admin);
create index if not exists notifications_event_id_idx on public.notifications (event_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists reports_reporter_idx on public.reports (reporter);
create index if not exists reports_reported_idx on public.reports (reported);
create index if not exists sent_birthdays_user_id_idx on public.sent_birthdays (user_id);
create index if not exists sent_milestones_user_id_idx on public.sent_milestones (user_id);
create index if not exists sent_notifications_user_id_idx on public.sent_notifications (user_id);
create index if not exists share_comment_reactions_user_id_idx on public.share_comment_reactions (user_id);
create index if not exists share_comments_viewer_idx on public.share_comments (viewer);
create index if not exists share_comments_author_idx on public.share_comments (author);
create index if not exists share_comments_owner_idx on public.share_comments (owner);
create index if not exists wish_claims_claimed_by_idx on public.wish_claims (claimed_by);
create index if not exists wish_claims_plan_id_idx on public.wish_claims (plan_id);
create index if not exists wishes_owner_idx on public.wishes (owner);

-- 3. Signed-out visitors can only check an invitation code; every other function needs an account.
revoke execute on function public.billing_applies(uuid) from public, anon;
revoke execute on function public.can_read_conversation(uuid,uuid,uuid) from public, anon;
revoke execute on function public.can_see_folder(text) from public, anon;
revoke execute on function public.can_see_plan_comments(uuid) from public, anon;
revoke execute on function public.can_see_share_image(text) from public, anon;
revoke execute on function public.can_write_folder(text) from public, anon;
revoke execute on function public.check_cover_limit() from public, anon;
revoke execute on function public.check_hidden_from() from public, anon;
revoke execute on function public.connected(uuid) from public, anon;
revoke execute on function public.connection_open(uuid) from public, anon;
revoke execute on function public.covered_count(uuid) from public, anon;
revoke execute on function public.end_shares_on_leave() from public, anon;
revoke execute on function public.fill_comment_reaction() from public, anon;
revoke execute on function public.fill_conversation_seen() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.in_group_plan(uuid) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_hidden_photo(text) from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_subscribed(uuid) from public, anon;
revoke execute on function public.member_joined_cover() from public, anon;
revoke execute on function public.my_billing() from public, anon;
revoke execute on function public.my_couple_id() from public, anon;
revoke execute on function public.my_couples() from public, anon;
revoke execute on function public.new_invite_code() from public, anon;
revoke execute on function public.notify_comment_reaction() from public, anon;
revoke execute on function public.notify_new_comment() from public, anon;
revoke execute on function public.notify_new_share_comment() from public, anon;
revoke execute on function public.people_open(uuid,uuid) from public, anon;
revoke execute on function public.plans_with(uuid) from public, anon;
revoke execute on function public.reset_reminders() from public, anon;
revoke execute on function public.secret_for_me(uuid) from public, anon;
revoke execute on function public.share_comment_open() from public, anon;
revoke execute on function public.subscription_changed() from public, anon;
revoke execute on function public.today_tr() from public, anon;
grant execute on function public.billing_applies(uuid) to authenticated, service_role;
grant execute on function public.can_read_conversation(uuid,uuid,uuid) to authenticated, service_role;
grant execute on function public.can_see_folder(text) to authenticated, service_role;
grant execute on function public.can_see_plan_comments(uuid) to authenticated, service_role;
grant execute on function public.can_see_share_image(text) to authenticated, service_role;
grant execute on function public.can_write_folder(text) to authenticated, service_role;
grant execute on function public.check_cover_limit() to authenticated, service_role;
grant execute on function public.check_hidden_from() to authenticated, service_role;
grant execute on function public.connected(uuid) to authenticated, service_role;
grant execute on function public.connection_open(uuid) to authenticated, service_role;
grant execute on function public.covered_count(uuid) to authenticated, service_role;
grant execute on function public.end_shares_on_leave() to authenticated, service_role;
grant execute on function public.fill_comment_reaction() to authenticated, service_role;
grant execute on function public.fill_conversation_seen() to authenticated, service_role;
grant execute on function public.handle_new_user() to authenticated, service_role;
grant execute on function public.in_group_plan(uuid) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_hidden_photo(text) to authenticated, service_role;
grant execute on function public.is_member(uuid) to authenticated, service_role;
grant execute on function public.is_subscribed(uuid) to authenticated, service_role;
grant execute on function public.member_joined_cover() to authenticated, service_role;
grant execute on function public.my_billing() to authenticated, service_role;
grant execute on function public.my_couple_id() to authenticated, service_role;
grant execute on function public.my_couples() to authenticated, service_role;
grant execute on function public.new_invite_code() to authenticated, service_role;
grant execute on function public.notify_comment_reaction() to authenticated, service_role;
grant execute on function public.notify_new_comment() to authenticated, service_role;
grant execute on function public.notify_new_share_comment() to authenticated, service_role;
grant execute on function public.people_open(uuid,uuid) to authenticated, service_role;
grant execute on function public.plans_with(uuid) to authenticated, service_role;
grant execute on function public.reset_reminders() to authenticated, service_role;
grant execute on function public.secret_for_me(uuid) to authenticated, service_role;
grant execute on function public.share_comment_open() to authenticated, service_role;
grant execute on function public.subscription_changed() to authenticated, service_role;
grant execute on function public.today_tr() to authenticated, service_role;
alter function public.today_tr() set search_path = public;
alter function public.new_invite_code() set search_path = public;
