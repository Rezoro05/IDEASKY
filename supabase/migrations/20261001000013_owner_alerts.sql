-- Sky of Ideas: the database emails the site's owner about each new public idea, dream and comment (replaces Formspree).
-- After a new row is saved, a trigger hands it to the `notify` Edge Function (pg_net, in the background), which sends the email through Resend.
-- The function's address and a shared secret come from the Vault, so nothing secret is in this file:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<a long random value>', 'notify_secret');   -- the same value as the function's NOTIFY_SECRET
-- Until both exist, nothing is sent. An alert can never stop a post: any failure here is swallowed. Safe to run again.

create extension if not exists pg_net with schema extensions;

-- The poster's email (optional, from the public note): saved for the owner's alert only. Visitors may send it but never read it.
alter table public.ideas add column if not exists contact_email text;
alter table public.ideas drop constraint if exists ideas_contact_email_shape;
alter table public.ideas add constraint ideas_contact_email_shape check (
  contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
grant insert (contact_email) on public.ideas to anon;
-- (no select grant on contact_email: the board never shows it)

create or replace function public.alert_owner() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  url text; secret text; r jsonb := to_jsonb(new); payload jsonb;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_secret';
  if url is null or secret is null then return new; end if;
  if tg_table_name = 'ideas' then
    payload := jsonb_build_object('type', coalesce(r->>'kind', 'idea'), 'id', r->>'id', 'name', r->>'name', 'message', r->>'message',
                                  'email', r->>'contact_email', 'links', coalesce(r->'links', '[]'::jsonb));
  elsif tg_table_name = 'comments' then
    payload := jsonb_build_object('type', 'comment', 'id', r->>'id', 'idea_id', r->>'idea_id', 'name', r->>'name', 'message', r->>'message',
                                  'idea_name', (select i.name from public.ideas i where i.id = r->>'idea_id'));
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

drop trigger if exists ideas_alert_owner on public.ideas;
create trigger ideas_alert_owner after insert on public.ideas for each row execute function public.alert_owner();
drop trigger if exists comments_alert_owner on public.comments;
create trigger comments_alert_owner after insert on public.comments for each row execute function public.alert_owner();

notify pgrst, 'reload schema';
