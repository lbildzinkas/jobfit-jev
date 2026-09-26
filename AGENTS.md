# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Status: specification only; no source code yet. [`docs/spec.md`](docs/spec.md) is the source of truth for scope, architecture, and milestones; update it in the same change when implementation diverges.
- Product boundaries in `docs/spec.md` §2 are owner decisions: analysis only, zero requests to LinkedIn and no page modification, Jev as the only model (OpenRouter default, TypeSafe direct as an option), CV header and protected attributes stripped in code, local storage only (never `storage.sync`). Do not relax one without an explicit owner decision recorded there.
- Jev is a typed-decision model, not a chat model: read [`docs/jev-guide.md`](docs/jev-guide.md) before designing any question or parsing any answer.
- LinkedIn selectors and their evidence: [`docs/linkedin-structure.md`](docs/linkedin-structure.md). The fixtures in `test/fixtures/linkedin/` are sanitized XHTML and must be parsed as `application/xhtml+xml`; an HTML parser moves the description's nested lists. Any new fixture must pass the same leak audit (no real text, ids, or names) before commit, because the repository is public.
- Borrow code only from MIT/Apache-2.0/BSD projects and record it in `THIRD_PARTY_NOTICES.md` (spec §12).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
