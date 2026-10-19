-- Sky of Ideas: private ideas and dreams for signed-in visitors (their own sky and sea). Safe to run again.
-- Only the signed-in owner can read, add, change or remove their own rows: row-level security checks auth.uid() on every request,
-- so nobody else (not other visitors, not the public site) can see them. Anonymous visitors get no access at all.
-- Categories are set by the `categorize` Edge Function using the owner's own sign-in, so the same rules apply to it.

create table if not exists public.private_items (
  id          text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null default 'idea' check (kind in ('idea', 'dream')),
  name        text not null default '' check (char_length(name) <= 40),
  message     text not null check (char_length(message) between 1 and 600),
  links       jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5),
  stage       text not null default 'idea' check (stage in ('idea', 'implementation', 'live')),
  categories  text[] check (
    categories is null or (
      cardinality(categories) <= 3 and (
        (kind = 'idea' and categories <@ array['tech','food-drink','city-places','health','learning','business','art-design','social-good','environment','play-games','science']::text[])
        or (kind = 'dream' and categories <@ array['flying','falling','chased','water','lost','people','places','animals','strange','nightmare']::text[])
      )
    )
  ),
  created_at  timestamptz not null default now()
);
create index if not exists private_items_owner_created on public.private_items (owner, created_at desc);

alter table public.private_items enable row level security;
revoke all on public.private_items from anon;
grant select, delete on public.private_items to authenticated;
grant insert (id, kind, name, message, links) on public.private_items to authenticated;
grant update (message, links, stage, categories) on public.private_items to authenticated;

drop policy if exists "owner reads"   on public.private_items;
drop policy if exists "owner adds"    on public.private_items;
drop policy if exists "owner changes" on public.private_items;
drop policy if exists "owner removes" on public.private_items;
create policy "owner reads"   on public.private_items for select to authenticated using (owner = auth.uid());
create policy "owner adds"    on public.private_items for insert to authenticated with check (owner = auth.uid());
create policy "owner changes" on public.private_items for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner removes" on public.private_items for delete to authenticated using (owner = auth.uid());

notify pgrst, 'reload schema';
