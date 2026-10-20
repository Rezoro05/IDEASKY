-- IDEA SKY: owners' updates on their ideas (run after the ideas and stages scripts; safe to run again).
-- Anyone reads updates. Only the idea's owner adds or removes them: the browser sends the idea's own key,
-- and these functions check it against the idea's stored hash. Up to 50 updates per idea.

create table if not exists public.idea_updates (
  id text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  idea_id text not null references public.ideas(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 600),
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5 and octet_length(links::text) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists idea_updates_idea_id on public.idea_updates (idea_id, created_at);
alter table public.idea_updates enable row level security;
revoke all on public.idea_updates from anon, authenticated;
grant select (id, idea_id, message, links, created_at) on public.idea_updates to anon;
drop policy if exists "anyone reads updates" on public.idea_updates;
create policy "anyone reads updates" on public.idea_updates for select to anon using (true);
-- No insert/delete grants: writes go only through the key-checked functions below.

create or replace function public.owns_idea(p_idea_id text, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ideas
                 where id = p_idea_id and delete_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'));
$$;
revoke all on function public.owns_idea(text, text) from public;

create or replace function public.add_idea_update(p_idea_id text, p_key text, p_id text, p_message text, p_links jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_idea(p_idea_id, p_key) then return false; end if;
  if (select count(*) from public.idea_updates where idea_id = p_idea_id) >= 50 then return false; end if;
  if (select count(*) from public.idea_updates where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'Too many updates right now, try again later';
  end if;
  insert into public.idea_updates (id, idea_id, message, links) values (p_id, p_idea_id, p_message, coalesce(p_links, '[]'::jsonb));
  return true;
end $$;
revoke all on function public.add_idea_update(text, text, text, text, jsonb) from public;
grant execute on function public.add_idea_update(text, text, text, text, jsonb) to anon;

create or replace function public.delete_idea_update(p_id text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.idea_updates u
  where u.id = p_id and public.owns_idea(u.idea_id, p_key);
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.delete_idea_update(text, text) from public;
grant execute on function public.delete_idea_update(text, text) to anon;

notify pgrst, 'reload schema';
