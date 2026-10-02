# IDEA SKY

A public sky of ideas: visitors fold an idea into a paper plane, it flies, and anyone can catch it, read it and comment. Astro + TypeScript, built as small tested parts. Plan and decisions: `status.md` in the Project.

```
src/content/      site name, copy and service settings
src/lib/          pure logic (flight sim, ideas, comments) — no DOM, unit-tested
src/boundaries/   the outside world: idea and comment stores (Supabase, memory), Formspree inbox, owner keys
src/islands/      thin page wiring: sky, board + letter, composer, comment thread
src/components/   page markup; src/layouts/Site.astro puts the page together
public/           fonts, .nojekyll
tests/unit        Vitest: pure modules, adapters against a fake network, flight behavior over time
tests/e2e         Playwright against the test build, with the board and inbox faked
```

## Services
Endpoints come from build-time environment variables, so no build points at a real service by accident:

| Variable | What |
|---|---|
| `PUBLIC_BOARD_URL`, `PUBLIC_BOARD_KEY` | Supabase project URL and publishable key |
| `PUBLIC_FORMSPREE_ENDPOINT` | Formspree form that emails new ideas and comments |

Unset (the default): the board lives in memory for the visit and nothing is emailed. Good for local testing.

## Commands
- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — the site into `dist/`
- `npm run test:e2e` — builds with fake service addresses, then runs the browser tests
- `npm run check` — type-check Astro and TypeScript

## Publishing
Not set up yet. Target: GitHub Pages at `rezoro05.github.io/IDEASKY/`, which needs the build to use the `/IDEASKY/` base path first. Pushes happen only when the owner says "push".
