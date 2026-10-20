-- IDEA SKY: stages and links on ideas (run after the ideas script; safe to run again).
-- Stage: idea → implementation → live. Every new idea starts at "idea"; only its owner (holder of the
-- delete key) can move it, one step at a time, through set_idea_stage. Links: up to 5 {title, url}.

alter table public.ideas add column if not exists stage text not null default 'idea'
  check (stage in ('idea', 'implementation', 'live'));
alter table public.ideas add column if not exists links jsonb not null default '[]'::jsonb
  check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5 and octet_length(links::text) <= 4000);

-- Visitors may read both and send links; they never set the stage directly.
grant select (id, name, message, stage, links, created_at) on public.ideas to anon;
grant insert (id, name, message, links, delete_key_hash) on public.ideas to anon;

create or replace function public.set_idea_stage(p_id text, p_key text, p_stage text) returns boolean
language plpgsql security definer set search_path = public as $$
declare stages text[] := array['idea', 'implementation', 'live']; cur text; n int;
begin
  if not (p_stage = any(stages)) then return false; end if;
  select stage into cur from public.ideas
  where id = p_id and delete_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  if cur is null or abs(array_position(stages, cur) - array_position(stages, p_stage)) <> 1 then return false; end if;
  update public.ideas set stage = p_stage where id = p_id;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.set_idea_stage(text, text, text) from public;
grant execute on function public.set_idea_stage(text, text, text) to anon;

notify pgrst, 'reload schema';
