# IDEA SKY

A public sky of ideas. Visitors fold an idea into a paper plane and send it into a full-screen sky over the New York skyline, where anyone can catch it, read it, like it and comment. Its author moves it from Idea (0) through Implementation (–) to Live (1); each stage flies as its own form (paper plane, airplane, bird), and the author adds dated updates along the way.

Astro + TypeScript, built as small tested parts. Plan and decisions: `status.md` in the Project.

## Layout
```
src/content/      site name, copy, service settings
src/lib/          pure rules, no DOM: ideas, stages, links, comments, updates, likes,
                  flight (sim, flight-path, orientation, motion, gesture), forms (the drawing per stage)
src/boundaries/   the outside world behind small interfaces, each with a Supabase and an in-memory version:
                  ideaStore, commentStore, likeStore, updateStore, inbox (Formspree), keyStore (browser keys)
src/islands/      page wiring: app (puts it together), sky, board, letter, composer (Idea Note),
                  thread (comments), likes, stage-panel, updates, flier, link-rows, link-list, dom
src/components/   markup; src/layouts/Site.astro is the one page
src/styles/       site.css, in sections: tokens, base, page, planes, overlays, paper cards, Idea Note, letter, preferences
supabase/         SQL for the board, run in order: 01 ideas, 02 comments, 03 likes, 04 stages and links, 05 updates
scripts/          skyline.py generates the skyline drawing
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
| `PUBLIC_FORMSPREE_ENDPOINT` | Formspree form that emails new ideas and comments |

Unset (the default): everything lives in memory for the visit and nothing is emailed. Good for local testing.

## Commands
- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — the site into `dist/`
- `npm run test:e2e` — builds with fake service addresses, then runs the browser tests
- `npm run check` — type-check Astro and TypeScript (unused code is an error)

## Publishing
Not set up yet. Target: GitHub Pages at `rezoro05.github.io/IDEASKY/`, which needs the `/IDEASKY/` base path first. Pushes happen only when the owner says "push".
