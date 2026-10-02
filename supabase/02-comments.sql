-- IDEA SKY: comments (run after 01; safe to run again). From the fork brief, unchanged.
create table if not exists public.comments (
  id text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  idea_id text not null references public.ideas(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  message text not null check (char_length(message) between 1 and 400),
  delete_key_hash text not null check (delete_key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists comments_idea_id on public.comments (idea_id, created_at);
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
grant select (id, idea_id, name, message, created_at) on public.comments to anon;
grant insert (id, idea_id, name, message, delete_key_hash) on public.comments to anon;
drop policy if exists "anyone reads comments" on public.comments;
drop policy if exists "anyone posts comments" on public.comments;
create policy "anyone reads comments" on public.comments for select to anon using (true);
create policy "anyone posts comments" on public.comments for insert to anon with check (true);

create or replace function public.comments_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comments where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many comments right now, try again later';
  end if;
  return new;
end $$;
drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments
for each row execute function public.comments_rate_limit();

create or replace function public.delete_comment(p_id text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.comments
  where id = p_id and delete_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.delete_comment(text, text) from public;
grant execute on function public.delete_comment(text, text) to anon;

notify pgrst, 'reload schema';
