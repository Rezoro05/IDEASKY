/** The database migrations, run for real in an in-memory Postgres (PGlite), with small stand-ins for what Supabase provides
 *  (the anon/authenticated roles, auth.uid(), the Vault and pg_net). Every file must run cleanly twice (they are safe to re-run). */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/migrations";
const SUPABASE_STANDINS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create schema extensions; create schema net; create schema vault;
  create table vault.secrets (name text, decrypted_secret text);
  create view vault.decrypted_secrets as select name, decrypted_secret from vault.secrets;
  create table net.calls (url text, body jsonb, headers jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
    returns bigint language plpgsql as $$ begin insert into net.calls values (url, body, headers); return 1; end $$;`;
const forPglite = (sql: string) => sql.replace(/create extension if not exists pg_net[^;]*;/g, "").replace(/notify pgrst[^;]*;/g, "");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

let db: PGlite;
const anon = async (sql: string) => { try { await db.exec(`set role anon; ${sql};`); return "allowed"; } catch { return "refused"; } finally { await db.exec("reset role"); } };

describe("database migrations", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SUPABASE_STANDINS);
    for (const f of files) for (let round = 0; round < 2; round++) await db.exec(forPglite(readFileSync(`${DIR}/${f}`, "utf8")));
  }, 60_000);

  it("are named in order, with unique versions", () => {
    const versions = files.map((f) => f.split("_")[0]!);
    expect(files.length).toBeGreaterThanOrEqual(13);
    expect(new Set(versions).size).toBe(files.length);
    expect(versions.every((v) => /^\d{14}$/.test(v))).toBe(true);
  });

  it("alert the owner about new ideas, dreams and comments, never with a secret in the body, and only once the Vault is set", async () => {
    await db.exec(`insert into public.ideas (id, name, message, delete_key_hash, contact_email) values ('alert01','Nino','hi', repeat('a',64), 'nino@example.com')`);
    expect((await db.query<{ n: number }>("select count(*)::int as n from net.calls")).rows[0]!.n).toBe(0); // no Vault yet: nothing sent, still saved
    await db.exec(`insert into vault.secrets values ('project_url','https://ref.supabase.co/'), ('notify_secret','s3cret')`);
    await db.exec(`insert into public.ideas (id, name, message, delete_key_hash, kind, contact_email) values ('alert02','Gio','I flew', repeat('b',64), 'dream', 'gio@example.com')`);
    await db.exec(`insert into public.comments (id, idea_id, name, message, delete_key_hash) values ('alertc1','alert01','Ana','nice', repeat('c',64))`);
    const calls = (await db.query<{ url: string; body: Record<string, unknown>; headers: Record<string, string> }>("select * from net.calls")).rows;
    expect(calls.map((c) => c.url)).toEqual(["https://ref.supabase.co/functions/v1/notify", "https://ref.supabase.co/functions/v1/notify"]);
    expect(calls[0]!.body).toMatchObject({ type: "dream", id: "alert02", name: "Gio", email: "gio@example.com" });
    expect(calls[1]!.body).toMatchObject({ type: "comment", idea_id: "alert01", idea_name: "Nino" });
    expect(calls[0]!.headers["x-notify-secret"]).toBe("s3cret");
    expect(JSON.stringify(calls.map((c) => c.body))).not.toContain("delete_key_hash");
  });

  it("an alert that fails never stops the post", async () => {
    await db.exec(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language plpgsql as $$ begin raise exception 'network down'; end $$`);
    await db.exec(`insert into public.ideas (id, name, message, delete_key_hash) values ('alert03','x','still saved', repeat('d',64))`);
    expect((await db.query("select 1 from public.ideas where id = 'alert03'")).rows).toHaveLength(1);
  });

  it("visitors may post an email but never read it back; private rows and the alert function are closed to them", async () => {
    expect(await anon(`insert into public.ideas (id, name, message, delete_key_hash, contact_email) values ('anon001','x','y', repeat('e',64), 'a@b.co')`)).toBe("allowed");
    expect(await anon("select id, name, message, stage, links, categories, kind, created_at from public.ideas")).toBe("allowed");
    expect(await anon("select contact_email from public.ideas")).toBe("refused");
    expect(await anon("select delete_key_hash from public.ideas")).toBe("refused");
    expect(await anon("select liker_hash from public.likes")).toBe("refused");
    expect(await anon("select * from public.private_items")).toBe("refused");
    expect(await anon("select public.alert_owner()")).toBe("refused");
  });

  it("refuses an email that isn't one, and counts comment likes in the database", async () => {
    await expect(db.exec(`insert into public.ideas (id, name, message, delete_key_hash, contact_email) values ('bademl1','x','y', repeat('f',64), 'nino@')`)).rejects.toThrow(/contact_email_shape/);
    await db.exec(`insert into public.comment_likes (comment_id, liker_hash) values ('alertc1', repeat('1',64)), ('alertc1', repeat('2',64))`);
    expect(await anon("select * from public.comment_like_counts(array['alertc1'])")).toBe("allowed");
    expect((await db.query("select * from public.comment_like_counts(array['alertc1','nothere'])")).rows).toEqual([{ comment_id: "alertc1", likes: 2 }]);
  });
});
