-- Sky of Ideas: feedback notes for the site's owner. Visitors can send one, nobody can read them (only the owner, in the dashboard),
-- and each new note is emailed to the owner through `notify`, like a new post. Safe to run again.

create table if not exists public.feedback (
  id         text primary key check (id ~ '^[a-z0-9]{6,20}$'),
  message    text not null check (char_length(message) between 1 and 1000),
  email      text check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  page       text check (page is null or char_length(page) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created on public.feedback (created_at);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant insert (id, message, email, page) on public.feedback to anon, authenticated;
drop policy if exists "anyone sends feedback" on public.feedback;
create policy "anyone sends feedback" on public.feedback for insert to anon, authenticated with check (true);
-- (no select policy or grant: notes are private)

create or replace function public.feedback_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.feedback where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Too much feedback right now, try again later';
  end if;
  return new;
end $$;
drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit before insert on public.feedback for each row execute function public.feedback_rate_limit();

-- The owner's alert, now for feedback too (as in migration 14, plus the feedback branch).
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
  elsif tg_table_name = 'feedback' then
    payload := jsonb_build_object('type', 'feedback', 'id', r->>'id', 'message', r->>'message', 'email', r->>'email', 'page', r->>'page');
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
  return new; -- the note is saved whatever happens to its email
end $$;
revoke all on function public.alert_owner() from public, anon, authenticated;

drop trigger if exists feedback_alert_owner on public.feedback;
create trigger feedback_alert_owner after insert on public.feedback for each row execute function public.alert_owner();

notify pgrst, 'reload schema';
