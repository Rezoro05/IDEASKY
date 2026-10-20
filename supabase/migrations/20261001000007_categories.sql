-- IDEA SKY: categories on ideas, set by the `categorize` Edge Function (Jev). Run before the site that reads them goes live; safe to run again.
-- null = not sorted yet; an empty list = sorted, nothing fit. Up to three known keys (the list in supabase/functions/_shared/categories.ts).
-- Visitors can read categories but never write them: the anon insert grant leaves the column out, and there is no update grant.

alter table public.ideas add column if not exists categories text[];
alter table public.ideas drop constraint if exists ideas_categories_known;
alter table public.ideas add constraint ideas_categories_known check (
  categories is null or (
    cardinality(categories) <= 3
    and categories <@ array['tech','food-drink','city-places','health','learning','business','art-design','social-good','environment','play-games','science']::text[]
  )
);
grant select (categories) on public.ideas to anon;
-- The categorize function runs as service_role; newer projects don't grant it new tables, so it gets exactly what it needs.
grant select on public.ideas to service_role;
grant update (categories) on public.ideas to service_role;

notify pgrst, 'reload schema';
