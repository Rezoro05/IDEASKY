-- Sky of Ideas: indexes for the board's reads and the rate-limit counts, and like counts on comments done by the database.
-- Run after 01–11; safe to run again. Changes no data.

-- The sky and the sea read the newest ideas or dreams (kind, newest first); every insert's rate-limit trigger counts the last 10 minutes.
create index if not exists ideas_kind_created on public.ideas (kind, created_at desc);
create index if not exists ideas_created on public.ideas (created_at);
create index if not exists comments_created on public.comments (created_at);
create index if not exists likes_created on public.likes (created_at);
create index if not exists comment_likes_created on public.comment_likes (created_at);
create index if not exists idea_updates_created on public.idea_updates (created_at);

-- Like counts for a set of comments, counted here instead of sending one row per like to the browser.
-- Runs as the caller (anon may already read comment_likes.comment_id), so it can show nothing a visitor couldn't count anyway.
create or replace function public.comment_like_counts(p_ids text[])
returns table (comment_id text, likes integer)
language sql stable security invoker set search_path = public as $$
  select l.comment_id, count(*)::integer
  from public.comment_likes l
  where l.comment_id = any (p_ids[1:200])
  group by l.comment_id;
$$;
revoke all on function public.comment_like_counts(text[]) from public, anon, authenticated;
grant execute on function public.comment_like_counts(text[]) to anon;

notify pgrst, 'reload schema';
