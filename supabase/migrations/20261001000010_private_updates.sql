-- Sky of Ideas: updates on your own private ideas (run after 09; safe to run again).
-- Like the public board's updates, but private: only the signed-in owner reads, adds or removes them (row-level security).
-- Up to 50 per idea. Removing a private idea removes its updates.

create table if not exists public.private_updates (
  id          text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  item_id     text not null references public.private_items (id) on delete cascade,
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message     text not null check (char_length(message) between 1 and 600),
  links       jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5 and octet_length(links::text) <= 4000),
  created_at  timestamptz not null default now()
);
create index if not exists private_updates_item on public.private_updates (item_id, created_at);

alter table public.private_updates enable row level security;
revoke all on public.private_updates from anon;
grant select, delete on public.private_updates to authenticated;
grant insert (id, item_id, message, links) on public.private_updates to authenticated;

drop policy if exists "owner reads"   on public.private_updates;
drop policy if exists "owner adds"    on public.private_updates;
drop policy if exists "owner removes" on public.private_updates;
create policy "owner reads"   on public.private_updates for select to authenticated using (owner = auth.uid());
-- Adding: it must be yours, on an idea that is yours, and that idea may hold at most 50.
create policy "owner adds"    on public.private_updates for insert to authenticated with check (
  owner = auth.uid()
  and exists (select 1 from public.private_items i where i.id = item_id and i.owner = auth.uid() and i.kind = 'idea')
  and (select count(*) from public.private_updates u where u.item_id = private_updates.item_id) < 50
);
create policy "owner removes" on public.private_updates for delete to authenticated using (owner = auth.uid());

notify pgrst, 'reload schema';
