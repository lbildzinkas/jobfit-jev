# jobfit-jev

A private-use Brave/Chromium (Manifest V3) extension that assesses your own CV against the LinkedIn job you have open, using TypeSafe's Jev typed-decision model.

**Status: spec only; implementation pending.**

## What it will do

- On an explicit **Analyze** click, read the job posting already rendered in the active tab. It makes no requests to LinkedIn, does not modify the page, and runs no background monitoring.
- Split the posting into requirement statements with deterministic code, then let you confirm or edit them. Required, preferred, and unclassified items stay separate.
- Strip your CV's header (name, contact details, address, links) and protected attributes in code, then ask Jev narrow typed questions (Choice, Noul, Score) about the evidence for each requirement.
- Show requirement-level verdicts with verbatim CV evidence, gaps, and "can't tell" reasons. Show a secondary, labeled required-coverage range. Eligibility (authorization, location, salary, clearance, relocation) appears in a separate strip outside the skills result.
- Keep everything local (`chrome.storage.local`, never sync). Jev is reached through OpenRouter by default, with TypeSafe direct as an option, using your own key.

## Documents

- [`docs/spec.md`](docs/spec.md): the specification: boundaries, architecture, extraction, Jev requests, verdict rules, UI, errors, tests, milestones, open questions.
- [`docs/jev-guide.md`](docs/jev-guide.md): how Jev works, verified API shapes, design patterns, and the worked mapping for this extension.
- [`docs/linkedin-structure.md`](docs/linkedin-structure.md): signed-in LinkedIn job page structure and selectors, with sanitized fixtures in [`test/fixtures/linkedin/`](test/fixtures/linkedin/).

## License

[MIT](LICENSE)
