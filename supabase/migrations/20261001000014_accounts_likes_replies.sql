-- Sky of Ideas: public posts that belong to an account, like counts in one request, and emails to a post's author when someone comments.
-- Safe to run again.

-- 1. A public idea or dream posted while signed in belongs to that account (owner). Posts from signed-out visitors have none,
--    and keep working with their browser key as before. Visitors never see who owns what: `owner` is not readable.
alter table public.ideas add column if not exists owner uuid default auth.uid() references auth.users (id) on delete set null;
create index if not exists ideas_owner on public.ideas (owner) where owner is not null;

grant usage on schema public to authenticated;
-- Signed in, you post the same columns a visitor does; `owner` is filled in by the database (its default), never sent.
grant insert (id, name, message, links, delete_key_hash, kind, contact_email) on public.ideas to authenticated;
drop policy if exists "members post ideas" on public.ideas;
create policy "members post ideas" on public.ideas for insert to authenticated with check (owner = auth.uid());

-- Owning an idea: this browser's key for it, or being its signed-in owner.
create or replace function public.owns_idea(p_idea_id text, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ideas
                 where id = p_idea_id
                   and ((p_key is not null and delete_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex'))
                        or (owner is not null and owner = auth.uid())));
$$;
revoke all on function public.owns_idea(text, text) from public, anon, authenticated;

create or replace function public.delete_idea(p_id text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.ideas where id = p_id and public.owns_idea(p_id, p_key);
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.set_idea_stage(p_id text, p_key text, p_stage text) returns boolean
language plpgsql security definer set search_path = public as $$
declare stages text[] := array['idea', 'implementation', 'live']; cur text; n int;
begin
  if not (p_stage = any(stages)) or not public.owns_idea(p_id, p_key) then return false; end if;
  select stage into cur from public.ideas where id = p_id;
  if cur is null or abs(array_position(stages, cur) - array_position(stages, p_stage)) <> 1 then return false; end if;
  update public.ideas set stage = p_stage where id = p_id;
  get diagnostics n = row_count;
  return n > 0;
end $$;

grant execute on function public.delete_idea(text, text) to anon, authenticated;
grant execute on function public.set_idea_stage(text, text, text) to anon, authenticated;
grant execute on function public.add_idea_update(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.delete_idea_update(text, text) to anon, authenticated;

-- Which public posts are yours (asked only by you, signed in): ids only, never anyone else's.
create or replace function public.my_idea_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select id from public.ideas where owner is not null and owner = auth.uid();
$$;
revoke all on function public.my_idea_ids() from public, anon, authenticated;
grant execute on function public.my_idea_ids() to authenticated;

-- Posts made from this browser before signing in join your account: each needs its own key, and only unowned posts can be claimed.
create or replace function public.claim_ideas(p_items jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then return 0; end if;
  update public.ideas i set owner = auth.uid()
  from jsonb_to_recordset(p_items) as c(id text, key text)
  where i.id = c.id and i.owner is null and c.key is not null
    and i.delete_key_hash = encode(sha256(convert_to(c.key, 'UTF8')), 'hex');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.claim_ideas(jsonb) from public, anon, authenticated;
grant execute on function public.claim_ideas(jsonb) to authenticated;

-- 2. Like counts for many ideas or dreams in one request (they make liked birds and fish a little bigger).
create or replace function public.like_counts(p_ids text[])
returns table (idea_id text, likes integer)
language sql stable security invoker set search_path = public as $$
  select l.idea_id, count(*)::integer from public.likes l where l.idea_id = any (p_ids[1:200]) group by l.idea_id;
$$;
revoke all on function public.like_counts(text[]) from public, anon, authenticated;
grant execute on function public.like_counts(text[]) to anon;

-- 3. The owner's alert for a comment also carries the post author's address (the email they left, or their account's), so `notify`
--    can tell them someone answered. The address never leaves the database except to that function.
create or replace function public.alert_owner() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  url text; secret text; r jsonb := to_jsonb(new); payload jsonb; post record;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_secret';
  if url is null or secret is null then return new; end if;
  if tg_table_name = 'ideas' then
    payload := jsonb_build_object('type', coalesce(r->>'kind', 'idea'), 'id', r->>'id', 'name', r->>'name', 'message', r->>'message',
                                  'email', r->>'contact_email', 'links', coalesce(r->'links', '[]'::jsonb));
  elsif tg_table_name = 'comments' then
    select i.name, i.kind, coalesce(i.contact_email, u.email) as email into post
    from public.ideas i left join auth.users u on u.id = i.owner where i.id = r->>'idea_id';
    payload := jsonb_build_object('type', 'comment', 'id', r->>'id', 'idea_id', r->>'idea_id', 'name', r->>'name', 'message', r->>'message',
                                  'idea_name', post.name, 'idea_kind', coalesce(post.kind, 'idea'), 'poster_email', post.email);
  else
    return new;
  end if;
  perform net.http_post(
    url := rtrim(url, '/') || '/functions/v1/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new; -- the post is saved whatever happens to its email
end $$;
revoke all on function public.alert_owner() from public, anon, authenticated;

notify pgrst, 'reload schema';
