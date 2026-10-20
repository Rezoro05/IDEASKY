-- IDEA SKY: dreams (Sea of Dreams). Run after 01–07; safe to run again. Must run before the site that sends `kind` goes live.
-- Dreams live in the ideas table, marked kind = 'dream', so comments, replies, likes, links and removal work for them unchanged.
-- Dreams have no stages and no owner updates (the database refuses both), and their categories are dream themes.

alter table public.ideas add column if not exists kind text not null default 'idea';
alter table public.ideas drop constraint if exists ideas_kind_known;
alter table public.ideas add constraint ideas_kind_known check (kind in ('idea', 'dream'));
grant select (kind) on public.ideas to anon;
grant insert (kind) on public.ideas to anon;

-- Categories: idea categories on ideas, dream themes on dreams (lists in supabase/functions/_shared/categories.ts).
alter table public.ideas drop constraint if exists ideas_categories_known;
alter table public.ideas add constraint ideas_categories_known check (
  categories is null or (
    cardinality(categories) <= 3 and (
      (kind = 'idea' and categories <@ array['tech','food-drink','city-places','health','learning','business','art-design','social-good','environment','play-games','science']::text[])
      or (kind = 'dream' and categories <@ array['flying','falling','chased','water','lost','people','places','animals','strange','nightmare']::text[])
    )
  )
);

-- A dream never leaves its first stage.
create or replace function public.dreams_have_no_stages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'dream' and new.stage <> 'idea' then raise exception 'Dreams have no stages'; end if;
  return new;
end $$;
drop trigger if exists dreams_have_no_stages on public.ideas;
create trigger dreams_have_no_stages before insert or update of stage on public.ideas
for each row execute function public.dreams_have_no_stages();

-- Dreams take no owner updates.
create or replace function public.dreams_have_no_updates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select kind from public.ideas where id = new.idea_id) = 'dream' then raise exception 'Dreams have no updates'; end if;
  return new;
end $$;
drop trigger if exists dreams_have_no_updates on public.idea_updates;
create trigger dreams_have_no_updates before insert on public.idea_updates
for each row execute function public.dreams_have_no_updates();

notify pgrst, 'reload schema';
