-- IDEA SKY: replies to comments, and likes on comments (run after the comments and likes scripts; safe to run again).
-- Replies go one level deep: a reply points at a top-level comment on the same idea (the database checks it).
-- Comment likes work like idea likes: one per browser (its liker id's hash), removable only with that id.

-- Replies
alter table public.comments add column if not exists parent_id text references public.comments(id) on delete cascade;
alter table public.comments drop constraint if exists comments_parent_not_self;
alter table public.comments add constraint comments_parent_not_self check (parent_id is null or parent_id <> id);
grant select (id, idea_id, parent_id, name, message, created_at) on public.comments to anon;
grant insert (id, idea_id, parent_id, name, message, delete_key_hash) on public.comments to anon;

create or replace function public.comments_one_level() returns trigger
language plpgsql security definer set search_path = public as $$
declare parent record;
begin
  if new.parent_id is null then return new; end if;
  select idea_id, parent_id into parent from public.comments where id = new.parent_id;
  if not found or parent.idea_id <> new.idea_id or parent.parent_id is not null then
    raise exception 'A reply must answer a top-level comment on the same idea';
  end if;
  return new;
end $$;
drop trigger if exists comments_one_level on public.comments;
create trigger comments_one_level before insert on public.comments
for each row execute function public.comments_one_level();

-- Likes on comments
create table if not exists public.comment_likes (
  comment_id text not null references public.comments(id) on delete cascade,
  liker_hash text not null check (liker_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (comment_id, liker_hash)
);
alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from anon, authenticated;
grant select (comment_id) on public.comment_likes to anon;            -- enough to count; hashes stay private
grant insert (comment_id, liker_hash) on public.comment_likes to anon;
drop policy if exists "anyone counts comment likes" on public.comment_likes;
drop policy if exists "anyone likes comments" on public.comment_likes;
create policy "anyone counts comment likes" on public.comment_likes for select to anon using (true);
create policy "anyone likes comments" on public.comment_likes for insert to anon with check (true);

create or replace function public.comment_likes_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comment_likes where created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'Too many likes right now, try again later';
  end if;
  return new;
end $$;
drop trigger if exists comment_likes_rate_limit on public.comment_likes;
create trigger comment_likes_rate_limit before insert on public.comment_likes
for each row execute function public.comment_likes_rate_limit();

create or replace function public.unlike_comment(p_comment_id text, p_liker text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.comment_likes
  where comment_id = p_comment_id and liker_hash = encode(sha256(convert_to(p_liker, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.unlike_comment(text, text) from public;
grant execute on function public.unlike_comment(text, text) to anon;

notify pgrst, 'reload schema';
