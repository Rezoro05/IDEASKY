# IDEA SKY

A public sky of ideas. Visitors fold an idea into a paper plane and send it into a full-screen sky over the New York skyline, where anyone can catch it, read it, like it and comment. Its author moves it from Idea through In Progress to Live; each stage flies as its own form (paper plane, airplane, bird), and the author adds dated updates along the way.

Astro + TypeScript, built as small tested parts. Plan and decisions: `status.md` in the Project.

## Layout
```
src/content/      site name, copy, service settings
public/           fonts and skyline.webp (the sky picture)
src/lib/          pure rules, no DOM: ideas, stages, links, comments, updates, likes,
                  flight (sim, flight-path, orientation, motion, gesture), forms (the drawing per stage)
src/boundaries/   the outside world behind small interfaces, each with a Supabase and an in-memory version:
                  ideaStore, commentStore, likeStore, updateStore, inbox (Formspree), keyStore (browser keys)
src/islands/      page wiring: app (puts it together), sky, board, letter, composer (Idea Note), feedback (footer note, emailed only),
                  thread (comments), likes, stage-panel, updates, flier, link-rows, link-list, dom
src/components/   markup; src/layouts/Site.astro is the one page
src/styles/       site.css, in sections: tokens, base, page, planes, overlays, paper cards, Idea Note, letter, preferences
supabase/         SQL for the board, run in order: 01 ideas, 02 comments, 03 likes, 04 stages and links, 05 updates
tests/unit        Vitest: pure rules and every store against a fake network
tests/e2e         Playwright, one file per feature, against the test build with the board and inbox faked (fixtures.ts)
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
| `PUBLIC_FORMSPREE_ENDPOINT` | Formspree form that emails new ideas, comments and feedback |
| `PUBLIC_DEMO_IDEAS` | `1` = a board with no service starts with five example ideas across the stages (previews, local runs). Ignored when a board is configured |
| `PUBLIC_BASE_PATH` | Where the site lives. Unset = `/`; the deploy workflow sets `/IDEASKY/` |

Unset (the default): everything lives in memory for the visit and nothing is emailed. Good for local testing.

## Commands
- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — the site into `dist/`
- `npm run test:e2e` — builds with fake service addresses, then runs the browser tests
- `npm run check` — type-check Astro and TypeScript (unused code is an error)

## Publishing
GitHub Pages at `rezoro05.github.io/IDEASKY/`, built by `.github/workflows/deploy.yml` on every push to `main` (type check and unit tests first; the browser tests run locally). One-time setup:

1. **Supabase:** new project, then run `supabase/01` to `05` in order in the SQL editor. Copy the project URL and the publishable key.
2. **Formspree:** one form that emails the owner. Copy its endpoint.
3. **GitHub, repo Settings:** Pages → Source = "GitHub Actions". Secrets and variables → Actions → **Variables**: `PUBLIC_BOARD_URL`, `PUBLIC_BOARD_KEY`, `PUBLIC_FORMSPREE_ENDPOINT`. (They end up in the public site by design, so they are Variables, not Secrets.)

The workflow refuses to build if any of the three is missing, so a deploy can't quietly ship an in-memory board. Pushes happen only when the owner says "push".
