# revazkuparadze.com: source

The site, rebuilt from the prototype as small tested parts (Astro, TypeScript). Plan: `rebuild-plan.md` in the Project.

```
src/content/      what the site says: ideas, path stops, craft, home copy, site settings
src/lib/          pure logic (flight sim, notes, routing, markup) — no DOM, unit-tested
src/boundaries/   the outside world: idea board stores (Supabase, claude.ai db, memory), Formspree inbox, delete keys
src/islands/      thin page wiring: router, sky, board + letter, composer, About path panel
src/components/   page markup; src/layouts/Site.astro puts a page together
public/           photos, logos, fonts, CNAME
tests/unit        Vitest: pure modules, adapters against fake fetch, flight behavior over time
tests/e2e         Playwright against the built site, with Supabase/Formspree faked
tests/parity      screenshots of the old site; the rebuild must match them
```

## Commands
- `npm test` — unit tests
- `npm run build` — live site into `dist/` (real URLs, SEO pages, sitemap)
- `npm run test:e2e` — browser tests against `dist/`
- `npm run parity` — screenshot `dist/` and compare with the baseline
- `npm run build:preview` — one-file preview for claude.ai (`dist-preview/preview.html`, #hash links)

## Publishing
Built here; `dist/` is copied to the `main` branch of github.com/Rezoro05/Ideas-to-1 and pushed only when the owner says "push".
