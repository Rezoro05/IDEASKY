-- Sky of Ideas: remembering which of your own ideas and dreams you shared on the public board (run after 09; safe to run again).
-- Sharing posts a copy on the public board (the ideas table, like any visitor's post); your own keeps the copy's id here,
-- so its letter shows "On the public board" and can take the copy down. Only you can read or change it (the rules from 09).

alter table public.private_items add column if not exists public_id text check (public_id is null or public_id ~ '^[a-z0-9]{6,20}$');
grant update (public_id) on public.private_items to authenticated;

notify pgrst, 'reload schema';
