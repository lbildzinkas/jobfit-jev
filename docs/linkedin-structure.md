# LinkedIn signed-in job page structure

Summary of a read-only inspection of live, signed-in LinkedIn job pages on 2026-09-23, plus a comparison with selector tables from open-source prior art.
It is the evidence behind the extraction design in [`spec.md`](spec.md) §5.
The sanitized structural fixtures it produced are in [`../test/fixtures/linkedin/`](../test/fixtures/linkedin/).

LinkedIn changes this markup without notice. Treat every selector here as dated evidence, re-check it against a live page when a read breaks, and re-capture the fixtures under the same privacy rules (§7).

## 1. Headline findings

- **Two layouts are live on the same account on the same day.**
  - AI/semantic search (`/jobs/search-results/`) and the standalone job page (`/jobs/view/<id>/`) use LinkedIn's new **server-driven UI (SDUI)** with hashed class names.
  - Jobs home "Recommended for you" (`/jobs/collections/recommended/`) still uses the **classic Ember layout** with `job-details-jobs-unified-top-card__*` and `#job-details`.
  - The extractor needs both paths.
- **No JSON-LD `JobPosting` on any signed-in page inspected** (zero `script[type="application/ld+json"]`). JSON-LD may stay as a free opportunistic check but must not be the primary path.
- **The full description is in the DOM on both layouts with no "see more" collapse.**
  - SDUI: `span[data-testid="expandable-text-box"]` inside the `aboutTheJob` component has no line clamp and no expand button; scroll height equals client height.
  - Classic: `#job-details` has no `jobs-description__footer-button`; scroll height equals client height.
  - Only SDUI's "About the company" box is clamped (`-webkit-line-clamp: 3`), and even its full text is in the DOM.
- **The best SDUI anchor is the `componentkey` attribute.** Every detail-pane component carries the job id, for example `componentkey="JobDetails_AboutTheJob_<jobId>"`. That gives a precise description selector and a stale-pane guard in one step.
- **`document.title` is useful only on SDUI.** There it is `"<Title> | <Company> | LinkedIn"`, and the segments exactly equal the top-card text. On classic it is a generic list title with a `(N)` notification prefix and must not be used.
- **Prior-art selectors:** the SDUI selectors from Dimakoua/job-match-resume and the classic `job-details-jobs-unified-top-card__*` / `#job-details` selectors still match. Every un-prefixed `jobs-unified-top-card__*` selector, `article.jobs-description`, `.jobs-description-content__text`, and the guest `show-more-less-html` selectors are dead on signed-in pages (§6).

## 2. Pages inspected

| # | Page | URL shape | Layout |
|---|---|---|---|
| 1 | AI job search, two-pane | `www.linkedin.com/jobs/search-results/?currentJobId=<id>&…` | SDUI, `data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails"` |
| 2 | Standalone job page | `www.linkedin.com/jobs/view/<id>/?…` | SDUI, `data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.JobDetails"` |
| 3 | Jobs > Recommended for you, two-pane | `www.linkedin.com/jobs/collections/recommended/?currentJobId=<id>` | Classic Ember (many `.ember-view`, no `data-sdui-*`) |

Pages 1 and 2 showed the same posting (identical title, company and description lengths), so their differences are layout differences.

Method: read-only script evaluation in an already-open tab. No navigation, clicks, scrolling, network reads, cookies or storage were touched. Probes returned structure only (tags, attribute names and values with ids redacted, counts, text lengths, clamp styles); text was returned only for an allowlist of section labels.

## 3. SDUI layout (pages 1 and 2)

### 3.1 Skeleton

- `main` contains everything, including the global nav (`[data-testid="primary-nav"]`) and search typeahead. **Scope every query to the detail root, never to `main`.**
- **Detail root:** `[data-sdui-screen$=".SemanticJobDetails"]` (search) or `[data-sdui-screen$=".JobDetails"]` (standalone). In the search view it wraps only the detail pane; the result list sits outside it.
- The detail pane is a `div[data-testid="lazy-column"]`. In search, the list is a separate `lazy-column` with `componentkey="SearchResultsMainContent"`.
- There is no `h1`. Section headings are `h2`.
- Named components (`data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.<name>"`), in document order:
  - Search: `jobMatch`, `peopleWhoCanHelp`, `aboutTheJob`, `premiumApplicantInsightsForJobDetails`, `premiumCompanyInsightsForJobDetails`, `aboutTheCompanyForJobDetails`.
  - Standalone adds `manageJobBanner`, `jobAlertToggle`, `resumeReview`, `similarJobs`.
- **The top card (title, company, location, pills, Apply/Save) is not inside any `data-sdui-component`.** Its only stable hook is the company link's `componentkey="auto-binding-<uuid>-<jobId>"`.
- Job-id-bearing keys in the detail pane (all equal to the URL job id): `JobDetails_AboutTheJob_<id>`, `JobDetails_AboutTheCompany_<id>`, `JobDetails_PremiumApplicantInsights_<id>`, `JobDetails_PremiumCompanyInsights_<id>`, `JobDetailsPeopleWhoCanHelpSlot_<id>`, `JobMatchRef_<id>`, `auto-binding-<uuid>-<id>`; standalone adds `JobDetails_ManageJobBanner_<id>`, `JobDetails_JobAlertToggle_<id>`, `JobDetails_ResumeReview_<id>`, `JobDetailsSimilarJobsSlot_<id>`.

### 3.2 Fields and fallback order

| Field | Evidence | Order |
|---|---|---|
| **Description** | `span[data-testid="expandable-text-box"]` in a `p` in the `aboutTheJob` component, whose parent carries `componentkey="JobDetails_AboutTheJob_<id>"`. Contains `br`, `strong`, `ul/li`, `a`, with block `ul` nested inside `p > span`. No clamp. | 1. `[componentkey="JobDetails_AboutTheJob_<jobId>"] [data-testid="expandable-text-box"]` 2. `[data-sdui-component$=".aboutTheJob"] [data-testid="expandable-text-box"]` 3. the longest `[data-testid="expandable-text-box"]` in the detail root (the description was ~8k chars vs ~330 for About the company). Never fall back to the whole `aboutTheJob` component: it includes the heading. |
| **"About the job" section** | The `h2` and the box are both inside `[data-sdui-component$=".aboutTheJob"]`. | Component attribute first; the English heading text is a last-resort anchor only. |
| **Title** | Search: `p > a[href*="/jobs/view/<id>/"]` whose text equals `document.title` segment 1. Standalone: a plain `p` (not a link) with the same text; there the `a[href*="/jobs/view/<id>/"]` links are pills and match buttons. | 1. The element in the detail root, outside any `data-sdui-component`, whose normalized text equals `document.title.split(' \| ')[0]` (strip a leading `(N) `). 2. `document.title` segment 1 alone, flagged low-confidence. Never "first `a[href*="/jobs/view/<id>"]`". |
| **Company** | `a[href*="/company/<slug>/life/"]` wrapped by the `auto-binding-…-<jobId>` link; two in the top card (logo, name), two more inside `aboutTheCompanyForJobDetails`. Text equals `document.title` segment 2. | 1. First `a[href*="/company/"]` in the detail root, outside any `data-sdui-component`, with text. 2. `document.title` segment 2. Cross-check 1 = 2. |
| **Location** | In the `p` right after the title block: `span`(location) `·` `span > strong`(time ago) `·` `span`(applicants). No hooks. | First `span` of the first `p` after the title whose text contains `·`, outside `data-sdui-component`. Position-based: medium confidence. |
| **Workplace type** | A pill link with text `Remote` (sibling `Full-time`) between the metadata line and Apply/Save. No attribute names it. | Text match `^(Remote\|Hybrid\|On-site)$` on `a`/`span` in the top-card region. English-only; report "unknown" when nothing matches. |

### 3.3 Job identity and selection

- **Search two-pane:** the URL `currentJobId` is the only explicit signal. List cards are `div[componentkey="job-card-component-ref-<jobId>"]`; the selected card has no `aria-current`/`aria-selected`/`aria-pressed` and differs only by one extra hashed class. Do not use the card.
- **Standalone:** id from the path `/jobs/view/<id>/`; the same `JobDetails_*_<id>` keys are present.
- **Stale-pane guard:** the id in `componentkey="JobDetails_AboutTheJob_<id>"` must equal the URL job id. This is stronger than the prior-art guard `main a[href*="/jobs/view/<id>"]`, which also matches list cards and pills.

### 3.4 Other observations

- No inline hydration payload: no `<code>` blobs and no inline script containing the job id.
- `iframe[data-testid="interop-iframe"]` and `div#interop-outlet[data-testid="interop-shadowdom"]` are overlay infrastructure; job content is in the light DOM.
- "People you can reach out to", premium insights and the match section are separate components, excluded by the "outside `data-sdui-component`" rule for top-card fields.

## 4. Classic layout (page 3)

| Field | Evidence | Order |
|---|---|---|
| **Description** | `div#job-details.jobs-box__html-content.jobs-description-content__text--stretch` inside `.jobs-description__content` inside `article.jobs-description__container`. Contains its own `h2` "About the job", then `p`, `ul/li`, `strong`, `br`. No clamp, no footer button. | 1. `#job-details` 2. `.jobs-description__content .jobs-box__html-content` 3. `.jobs-box__html-content` 4. `.jobs-description-content__text--stretch`. Strip the leading `h2` "About the job". |
| **Title** | `.job-details-jobs-unified-top-card__job-title > h1 > a[href="/jobs/view/<id>/"]`; the only `h1`. | 1. `.job-details-jobs-unified-top-card__job-title h1` 2. `h1.t-24` 3. `h1`. Never `document.title`. |
| **Company** | `.job-details-jobs-unified-top-card__company-name > a`. | 1. `.job-details-jobs-unified-top-card__company-name a` 2. `.job-details-jobs-unified-top-card__company-name`. The first `a[href*="/company/"]` on the page is **not** the top-card company here. |
| **Location** | First `span.tvm__text.tvm__text--low-emphasis` in `.job-details-jobs-unified-top-card__primary-description-container`, followed by `·` time-ago `·` applicants. | `…__primary-description-container .tvm__text` (first), then `…__tertiary-description-container .tvm__text` (first). |
| **Workplace type** | `.job-details-fit-level-preferences` → `button` pills each with a `strong` (e.g. "Hybrid", "Full-time"). | Regex `\b(Remote\|Hybrid\|On-site)\b` over `.job-details-fit-level-preferences button strong`. English-only. |
| **Selected card** | `div.job-card-container.jobs-search-results-list__list-item--active[aria-current="page"][data-job-id="<id>"]`. The legacy `…two-pane__job-card-container--active` class is gone. | URL `currentJobId` first; card only as a cross-check. |
| **Stale-pane guard** | The detail `h1 > a` links to `/jobs/view/<id>/`; `.jobs-apply-button` elements carry `data-job-id="<id>"`. | Require the h1 link id or the apply-button `data-job-id` to equal the URL job id. |

Other classic facts:

- Detail root: `.jobs-search__job-details` (= `.scaffold-layout__detail`).
- There are `<code>` hydration blobs, one containing the job id. **Do not read them**: on SPA navigation they can describe the job that loaded first, not the one shown.
- The messaging overlay lives outside `main`; one more reason to scope queries to the detail root.

## 5. Detecting a job change

- The search and recommended views switch jobs by changing `currentJobId` (`pushState` navigation); the standalone view uses the path id.
- The detail-pane id comes from the SDUI `componentkey` or the classic h1 link / apply button.
- `document.title` changes per job on SDUI only.

The click-to-analyze design needs **no page-side listener**: at Analyze time read the URL job id and the detail-pane job id; if they differ, or the pane has no id, report "page still loading, click Analyze again". To mark a shown result as stale, the extension can listen to `chrome.tabs.onUpdated` URL changes without any content script or DOM mutation.

## 6. Prior-art selectors against the live pages

Match counts per page: SDUI search / SDUI standalone / classic.

**YuxiaoMa66/linkedin-job-match-extension `src/content/index.js:98-145` @1531287 (MIT):**

| Selector | SDUI search | SDUI view | Classic | Verdict |
|---|---|---|---|---|
| `#job-details` | - | - | 1 | ✅ classic (best) |
| `.jobs-description__content .jobs-box__html-content` | - | - | 1 | ✅ classic |
| `.jobs-description-content__text--stretch` | - | - | 1 | ✅ classic |
| `.jobs-box__html-content`, `.jobs-description__content` | - | - | 1 | ✅ classic |
| `.jobs-description__container` | - | - | 1 | ⚠️ the `article` wrapper, includes heading |
| `.jobs-description-content__text` | - | - | - | ❌ dead (only the `--stretch` modifier remains) |
| `.jobs-description-details__text`, `.jobs-unified-description__content`, `article.jobs-description` | - | - | - | ❌ dead |
| `.show-more-less-html__markup`, `.top-card-layout__title`, `.topcard__org-name-link`, `.topcard__flavor--bullet` | - | - | - | ❌ guest-only |
| `.job-details-jobs-unified-top-card__job-title h1` | - | - | 1 | ✅ classic (best) |
| `h1.t-24`, `h1` | - | - | 1 | ✅ classic only; SDUI has no `h1` |
| `.job-details-jobs-unified-top-card__company-name (a)` | - | - | 1 | ✅ classic |
| `.job-details-jobs-unified-top-card__primary-description-container .tvm__text` | - | - | 8 | ✅ classic; first match is the location |
| every `.jobs-unified-top-card__*` (un-prefixed) and `…__bullet` selector | - | - | - | ❌ dead |

Its SDUI path anchors on the English "About the job" heading; the `componentkey` / `data-sdui-component` route is locale-independent and strictly better.

**Dimakoua/job-match-resume `content.js:6-14`, `:121-128` @9f6c2d6 (MIT):**

| Selector | SDUI search | SDUI view | Classic | Verdict |
|---|---|---|---|---|
| `[data-sdui-component*="aboutTheJob"] [data-testid="expandable-text-box"]` | 1 | 1 | - | ✅ SDUI (best without the job id) |
| `[data-testid="expandable-text-box"]` (unscoped) | 2 | 2 | - | ⚠️ also matches About the company; scope it or take the longest |
| `[data-sdui-component*="aboutTheJob"]` | 1 | 1 | - | ⚠️ includes the heading |
| `.jobs-description__content`, `.jobs-box__html-content`, `#job-details` | - | - | 1 | ✅ classic |
| `.jobs-description-content__text`, `.jobs-box--nameless`, `[class*="job-description"]` | - | - | - | ❌ no match |

**Facts from other projects (ideas only, no code reuse):** title and company from `document.title` hold on SDUI and fail on classic; "company = first `a[href*="/company/"]`" holds on SDUI and fails on classic; "description = longest `expandable-text-box`" holds on SDUI; layout detection by `[data-sdui-screen]` / `[data-sdui-component]` / no `h1` holds on all three pages.

## 7. Fixtures

| File | Layout / page | Test URL |
|---|---|---|
| `test/fixtures/linkedin/sdui-search-results-two-pane.xhtml` | SDUI `SemanticJobDetails`, AI search two-pane | `https://www.linkedin.com/jobs/search-results/?currentJobId=1000000001` |
| `test/fixtures/linkedin/sdui-job-view-standalone.xhtml` | SDUI `JobDetails`, standalone | `https://www.linkedin.com/jobs/view/1000000001/` |
| `test/fixtures/linkedin/classic-collections-recommended-two-pane.xhtml` | Classic Ember, Recommended two-pane | `https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1000000001` |

Sanitization ran **inside the page**, so only sanitized markup ever left the browser:

- Only `main` is kept. Global nav, typeahead, interop overlay, scripts, styles, iframes and `<code>` blobs are removed; the job list is trimmed to the selected card plus two others; SVG bodies are emptied; `style`, `src`, `srcset` dropped.
- Every text node and every `aria-label`/`title`/`alt` becomes a `T<n> xxx…` placeholder. The same source string always maps to the same placeholder, so equalities such as title = `document.title` segment survive. Length is exact up to 10 characters, otherwise rounded up to the next 10. A small allowlist of UI labels is kept verbatim ("About the job", "About the company", "Remote", "Hybrid", "Full-time", "Apply", "Save", "·", …).
- Ids of 5+ digits are remapped (the selected job is always `1000000001`); UUIDs are remapped; the company slug becomes `example-co`, profile slugs `redacted`, external links `example.com`; query strings are dropped; tracking-token attributes are set to `redacted`. Hashed CSS class names are kept (structural only).
- `<title>` is rebuilt from the same placeholders.
- Leak audit before committing: no non-placeholder text outside the allowlist, no non-placeholder labels, no un-remapped 5+ digit numbers or UUIDs outside class names, no email addresses, every `href` a LinkedIn path pattern, `#`, or `example.com`.

**Load them as XHTML.** SDUI nests `ul` inside `p > span`; an HTML parser silently moves the list out of the description box (an early HTML capture shrank the description to about a quarter of its length). Use `new JSDOM(src, { contentType: 'application/xhtml+xml', url })` or `DOMParser` with `application/xhtml+xml`. The same caveat applies in the extension: read the box's live nodes or its `innerHTML`, never re-parse the enclosing `p`'s `outerHTML` as HTML.

A throwaway reference extractor following §3–§4 found every field on all three fixtures, and its stale-pane check returned `stale-pane` when the URL job id was set to `1000000002` on the SDUI search and classic fixtures.

## 8. Limits of this evidence

- One account, one day, English UI. No non-English posting was inspected; workplace type and heading anchors are English-text matches.
- Rollout of SDUI is per account or experiment. Other accounts may see only one layout, or a third.
- `data-testid` and `componentkey` values are internal and can change; expect a selector fix every few months.
