/** The database migrations, run for real in an in-memory Postgres (PGlite), with small stand-ins for what Supabase provides
 *  (the anon/authenticated roles, auth.uid(), the Vault and pg_net). Every file must run cleanly twice (they are safe to re-run). */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/migrations";
const SUPABASE_STANDINS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users (id uuid primary key, email text);
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
    expect(files.length).toBeGreaterThanOrEqual(15);
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
    expect(calls[1]!.body).toMatchObject({ type: "comment", idea_id: "alert01", idea_name: "Nino", poster_email: "nino@example.com" }); // so the author hears of it
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

  it("a post made while signed in belongs to that account: it can remove, move and update it from anywhere, without the key", async () => {
    const me = "11111111-1111-1111-1111-111111111111", other = "22222222-2222-2222-2222-222222222222";
    await db.exec(`insert into auth.users values ('${me}', 'me@example.com'), ('${other}', 'other@example.com')`);
    const as = async (uid: string, sql: string) => {
      await db.exec(`set test.uid = '${uid}'; set role authenticated;`);
      try { return (await db.query(sql)).rows; } finally { await db.exec("reset role; set test.uid = '';"); }
    };
    await as(me, `insert into public.ideas (id, name, message, delete_key_hash) values ('mine001','Rez','mine', repeat('9',64))`);
    expect((await db.query("select owner from public.ideas where id = 'mine001'")).rows).toEqual([{ owner: me }]);
    expect(await as(me, "select * from public.my_idea_ids()")).toEqual([{ my_idea_ids: "mine001" }]);
    expect(await as(other, "select * from public.my_idea_ids()")).toEqual([]);
    expect(await as(other, "select public.set_idea_stage('mine001', null, 'implementation') as ok")).toEqual([{ ok: false }]); // not theirs
    expect(await as(me, "select public.set_idea_stage('mine001', null, 'implementation') as ok")).toEqual([{ ok: true }]);
    expect(await as(me, "select public.add_idea_update('mine001', null, 'upd0001', 'progress', '[]') as ok")).toEqual([{ ok: true }]);
    expect(await as(other, "select public.delete_idea('mine001', null) as ok")).toEqual([{ ok: false }]);
    expect(await as(me, "select public.delete_idea('mine001', null) as ok")).toEqual([{ ok: true }]);
  });

  it("posts from this browser join your account with their keys; someone else's can't be claimed, and nobody can set an owner directly", async () => {
    const me = "11111111-1111-1111-1111-111111111111";
    const hash = (k: string) => `encode(sha256(convert_to('${k}', 'UTF8')), 'hex')`;
    await db.exec(`insert into public.ideas (id, name, message, delete_key_hash) values ('old0001','x','before signing in', ${hash("key-one")}), ('old0002','y','someone else', ${hash("key-two")})`);
    await db.exec(`set test.uid = '${me}'; set role authenticated;`);
    const claimed = (await db.query<{ n: number }>(`select public.claim_ideas('[{"id":"old0001","key":"key-one"},{"id":"old0002","key":"wrong"}]') as n`)).rows[0]!.n;
    let direct = "allowed";
    try { await db.exec(`insert into public.ideas (id, name, message, delete_key_hash, owner) values ('hack001','x','y', repeat('0',64), '${me}')`); } catch { direct = "refused"; }
    await db.exec("reset role; set test.uid = '';");
    expect(claimed).toBe(1);
    expect((await db.query("select id, owner is not null as owned from public.ideas where id in ('old0001','old0002') order by id")).rows).toEqual([{ id: "old0001", owned: true }, { id: "old0002", owned: false }]);
    expect(direct).toBe("refused");
    expect(await anon("select owner from public.ideas")).toBe("refused"); // who owns what stays private
    expect(await anon("select * from public.my_idea_ids()")).toBe("refused");
    expect(await anon(`select public.claim_ideas('[]')`)).toBe("refused");
  });

  it("counts likes for many ideas in one request", async () => {
    await db.exec(`insert into public.likes (idea_id, liker_hash) values ('alert01', repeat('1',64)), ('alert01', repeat('2',64)), ('alert02', repeat('3',64))`);
    expect(await anon("select * from public.like_counts(array['alert01'])")).toBe("allowed");
    expect((await db.query("select * from public.like_counts(array['alert01','alert02','nothere']) order by idea_id")).rows).toEqual([{ idea_id: "alert01", likes: 2 }, { idea_id: "alert02", likes: 1 }]);
  });

  it("feedback: anyone can send a note, nobody can read it back, and the owner is emailed", async () => {
    await db.exec(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language plpgsql as $$ begin insert into net.calls values (url, body, headers); return 1; end $$`);
    await db.exec("delete from net.calls");
    expect(await anon(`insert into public.feedback (id, message, email, page) values ('fdb0001', 'Lovely sky', 'ana@example.com', 'https://x/')`)).toBe("allowed");
    expect(await anon("select * from public.feedback")).toBe("refused");
    expect(await anon(`insert into public.feedback (id, message, email) values ('fdb0002', 'x', 'not-an-email')`)).toBe("refused");
    const calls = (await db.query<{ body: Record<string, unknown> }>("select body from net.calls")).rows;
    expect(calls.map((c) => c.body)).toEqual([{ type: "feedback", id: "fdb0001", message: "Lovely sky", email: "ana@example.com", page: "https://x/" }]);
  });
});
