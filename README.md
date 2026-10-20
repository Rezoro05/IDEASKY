# Sky of Ideas

_(Formerly IDEA SKY; the repository and web address keep the old name.)_

A public sky of ideas. Visitors fold an idea into a paper plane and send it into a full-screen sky over the New York skyline, where anyone can catch it, read it, like it and comment. Its author moves it from Idea through In Progress to Live; each stage flies as its own form (paper plane, airplane, bird), and the author adds dated updates along the way.

Astro + TypeScript, built as small tested parts. Plan and decisions: `status.md` in the Project.

## Layout
```
src/content/      site name, copy, service settings
public/           fonts and skyline.webp (the sky picture)
src/lib/          pure rules, no DOM: ideas, stages, links, comments, updates, likes,
                  flight (sim, flight-path, orientation, motion, gesture), forms (the drawing per stage)
src/boundaries/   the outside world behind small interfaces, each with a Supabase and an in-memory version:
                  ideaStore, commentStore, likeStore, updateStore, privateStore, auth, keyStore (browser keys)
src/islands/      page wiring: app (puts it together), sky, board, letter, composer (Idea Note), account, mode-switch, go-public,
                  thread (comments), likes, stage-panel, updates, flier, link-rows, link-list, dom
                  3D backgrounds: splats, skyline-splats (the picture given depth), deep-sea, scene-camera, scene-settings, splat-sort, mat4
src/boundaries/splatGl.ts  the WebGL2 splat renderer (null without WebGL2: the picture stays)
src/islands/backgrounds.ts, scene.ts, studio.ts  the backgrounds' wiring (loaded after the page is up), and the owner's control center at …/#studio
src/components/   markup; src/layouts/Site.astro is the one page
src/styles/       site.css, in sections: tokens, base, page, planes, overlays, paper cards, Idea Note, letter, preferences
supabase/         the board, managed with the Supabase CLI: config.toml, migrations/ (the database, applied in order on every push),
                  functions/ (Edge Functions: categorize = Jev sorting, notify = emails the owner through Resend; _shared = their tested logic)
tests/unit        Vitest: pure rules and every store against a fake network
tests/e2e         Playwright, one file per feature, against the test build with the board faked (fixtures.ts)
                  (tests/unit/migrations.test.ts runs every migration twice in an in-memory Postgres)
```

## Rules the code keeps
- Pure logic in `lib/`; side effects only in `boundaries/` and `islands/`.
- Stores never throw: failures come back as `false` or `null`, and the page says so.
- Owner actions (remove, move stage, updates) prove ownership with the browser's key for that idea; the database checks its hash.
- Visitor links are http/https only; links open in a new tab with `noopener`.
- Reduced motion gets a plain list instead of the sky; the sky holds still while a letter or the Idea Note is open.

## Services
Endpoints come from build-time environment variables, so no build points at a real service by accident:

| Variable | What |
|---|---|
| `PUBLIC_BOARD_URL`, `PUBLIC_BOARD_KEY` | Supabase project URL and publishable key |
| `PUBLIC_DEMO_IDEAS` | `1` = a board with no service starts with five example ideas across the stages (previews, local runs). Ignored when a board is configured |
| `PUBLIC_SCENE` | `0` = no 3D backgrounds by default (the browser-test builds); the studio can still turn them on in one browser |
| `PUBLIC_BASE_PATH` | Where the site lives. Unset = `/`; the deploy workflow sets `/IDEASKY/` |

Unset (the default): everything lives in memory for the visit and nothing is emailed. Good for local testing.
Emails to the owner don't come from the site: after each new public idea, dream or comment, the database calls the `notify` function, which sends it through Resend.

## Commands
- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — the site into `dist/`
- `npm run test:e2e` — builds with fake service addresses, then runs the browser tests
- `npm run check` — type-check Astro and TypeScript (unused code is an error)

## Publishing
GitHub Pages at `rezoro05.github.io/IDEASKY/`, by `.github/workflows/deploy.yml` on every push to `main`: first the database (new migrations, then the Edge Functions), then the site (type check and unit tests first; the browser tests run locally). One-time setup:

1. **Supabase:** a project; copy its URL and publishable key.
2. **GitHub, repo Settings:** Pages → Source = "GitHub Actions". Secrets and variables → Actions:
   - **Variables** `PUBLIC_BOARD_URL`, `PUBLIC_BOARD_KEY` (they end up in the public site by design);
   - **Secrets** `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens) and `SUPABASE_DB_PASSWORD` (Project Settings → Database). Without them the database step is skipped with a notice.
   - For this project (01–11 were run by hand before the CLI), run the workflow once by hand with **baseline** ticked.
3. **Emails (Resend):** an account at resend.com and an API key. Then:
   - Supabase → Edge Functions → Secrets: `RESEND_API_KEY`, `NOTIFY_TO` (your address), `NOTIFY_SECRET` (a long random value), optional `NOTIFY_FROM` (a sender on your verified domain; until then Resend's test sender, which can only write to you).
   - SQL editor, once: `select vault.create_secret('https://<project-ref>.supabase.co', 'project_url'); select vault.create_secret('<the same NOTIFY_SECRET>', 'notify_secret');`
   - Sign-in emails: Authentication → Emails → SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = the API key, sender on your verified domain.

With **neither** board variable set, the workflow publishes a **preview**: an in-memory board with five example ideas (nothing is saved or emailed). With only **one** set, it fails and names what is missing, so a half-configured deploy can't ship. Pushes happen only when the owner says "push".
