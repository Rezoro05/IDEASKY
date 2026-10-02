-- IDEA SKY: ideas (run first; safe to run again). From the fork brief, unchanged.
create table if not exists public.ideas (
  id text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  name text not null check (char_length(name) between 1 and 40),
  message text not null check (char_length(message) between 1 and 600),
  delete_key_hash text not null check (delete_key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.ideas enable row level security;
revoke all on public.ideas from anon, authenticated;
grant usage on schema public to anon;
grant select (id, name, message, created_at) on public.ideas to anon;
grant insert (id, name, message, delete_key_hash) on public.ideas to anon;
drop policy if exists "anyone reads ideas" on public.ideas;
drop policy if exists "anyone posts ideas" on public.ideas;
create policy "anyone reads ideas" on public.ideas for select to anon using (true);
create policy "anyone posts ideas" on public.ideas for insert to anon with check (true);

create or replace function public.ideas_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ideas where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Too many ideas right now, try again later';
  end if;
  return new;
end $$;
drop trigger if exists ideas_rate_limit on public.ideas;
create trigger ideas_rate_limit before insert on public.ideas
for each row execute function public.ideas_rate_limit();

create or replace function public.delete_idea(p_id text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.ideas
  where id = p_id and delete_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.delete_idea(text, text) from public;
grant execute on function public.delete_idea(text, text) to anon;

notify pgrst, 'reload schema';
