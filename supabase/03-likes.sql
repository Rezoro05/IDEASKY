-- IDEA SKY: likes (run after the ideas script; safe to run again).
-- A like belongs to a browser for now: the browser keeps a random liker id and sends only its hash.
-- One like per idea per browser (primary key). Unliking needs the id itself, which only that browser has.

create table if not exists public.likes (
  idea_id text not null references public.ideas(id) on delete cascade,
  liker_hash text not null check (liker_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (idea_id, liker_hash)
);
alter table public.likes enable row level security;
revoke all on public.likes from anon, authenticated;
grant select (idea_id) on public.likes to anon;            -- enough to count; hashes stay private
grant insert (idea_id, liker_hash) on public.likes to anon;
drop policy if exists "anyone counts likes" on public.likes;
drop policy if exists "anyone likes" on public.likes;
create policy "anyone counts likes" on public.likes for select to anon using (true);
create policy "anyone likes" on public.likes for insert to anon with check (true);

create or replace function public.likes_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.likes where created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'Too many likes right now, try again later';
  end if;
  return new;
end $$;
drop trigger if exists likes_rate_limit on public.likes;
create trigger likes_rate_limit before insert on public.likes
for each row execute function public.likes_rate_limit();

create or replace function public.unlike_idea(p_idea_id text, p_liker text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.likes
  where idea_id = p_idea_id and liker_hash = encode(sha256(convert_to(p_liker, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.unlike_idea(text, text) from public;
grant execute on function public.unlike_idea(text, text) to anon;

notify pgrst, 'reload schema';
