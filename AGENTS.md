# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Status: M0 scaffold only (empty popup and full tab). [`docs/spec.md`](docs/spec.md) is the source of truth for scope, architecture, and milestones (§15 tracks status); update it in the same change when implementation diverges.
- Commands: `npm run check` (ESLint, Prettier check, `tsc -b`, Vitest) must pass before every commit; `npm run build` writes the unpacked extension to `dist/` (`npm run build:watch` rebuilds on change). Load it in Brave via `brave://extensions` → Developer mode → Load unpacked → `dist/`, and press the card's reload icon after each rebuild. The full tab is `chrome-extension://<id>/app.html`, also reachable from the popup.
- Layout: `public/manifest.json` (copied verbatim), `popup.html`/`app.html` → `src/popup/`, `src/app/` (React + Tailwind), service worker `src/background/`. The pure rules go in a framework-free `src/core/` (lint forbids React and browser globals there). Network APIs are allowed only under `src/background/provider/`; `test/static/` enforces this and the other spec §11.1 checks.
- TypeScript stays on 6.0.x: typescript-eslint does not support TypeScript 7 yet.
- Headless load check: start Brave or Chromium with `--headless=new --load-extension=<absolute dist path> --disable-extensions-except=<same> --remote-debugging-port=<port>`; chrome-devtools-mcp (under chrome-devtools-axi) opens `chrome-extension://` pages only when started with `--categoryExtensions`.
- Product boundaries in `docs/spec.md` §2 are owner decisions: analysis only, zero requests to LinkedIn and no page modification, Jev as the only model (OpenRouter default, TypeSafe direct as an option), CV header and protected attributes stripped in code, local storage only (never `storage.sync`). Do not relax one without an explicit owner decision recorded there.
- Jev is a typed-decision model, not a chat model: read [`docs/jev-guide.md`](docs/jev-guide.md) before designing any question or parsing any answer.
- LinkedIn selectors and their evidence: [`docs/linkedin-structure.md`](docs/linkedin-structure.md). The fixtures in `test/fixtures/linkedin/` are sanitized XHTML and must be parsed as `application/xhtml+xml`; an HTML parser moves the description's nested lists. Any new fixture must pass the same leak audit (no real text, ids, or names) before commit, because the repository is public.
- Borrow code only from MIT/Apache-2.0/BSD projects and record it in `THIRD_PARTY_NOTICES.md` (spec §12). Every production dependency must be listed there too; a test fails otherwise.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
