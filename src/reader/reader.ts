// The LinkedIn job page reader (docs/spec.md §5). A pure function over a
// parsed page: no listeners, timers, observers, or network requests, and it
// never writes to the DOM. The Analyze flow (a later milestone) injects a thin
// wrapper that calls `extractJobPosting(document, location.href)`.

import {
  jobScopedDescription,
  patterns,
  selectors,
  stepLabels,
} from './selectors'
import type {
  Description,
  ExtractionResult,
  FailureCode,
  Field,
  JobUrl,
  Layout,
  SelectorHit,
} from './types'
import { charCountOf, normalizeText, walkBlocks } from './walker'

// Loud-failure floors (docs/spec.md §5.5).
const minDescriptionChars = 300
const minDescriptionBlocks = 3

export function extractJobPosting(
  doc: Document,
  pageUrl: string,
): ExtractionResult {
  const health: SelectorHit[] = []
  // Whatever the steps below found before a failure short-circuits the flow;
  // failure results still carry it, so the popup can show what went missing.
  const found: Pick<
    ExtractionResult,
    | 'paneJobId'
    | 'title'
    | 'company'
    | 'location'
    | 'workplaceType'
    | 'description'
  > = {}

  const result = (ok: boolean, failure?: FailureCode): ExtractionResult => ({
    ok,
    failure,
    layout: 'unknown',
    url: { jobId: '', source: 'path' },
    health,
    ...found,
  })

  // 1. Guard: host is www.linkedin.com and the path is under /jobs/.
  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return result(false, 'not_linkedin_job')
  }
  const isJobsPath =
    url.pathname === '/jobs' || url.pathname.startsWith('/jobs/')
  if (url.hostname !== 'www.linkedin.com' || !isJobsPath) {
    return result(false, 'not_linkedin_job')
  }

  const withIdentity =
    (jobUrl: JobUrl, layout: Layout) =>
    (ok: boolean, failure?: FailureCode): ExtractionResult => ({
      ...result(ok, failure),
      url: jobUrl,
      layout,
    })

  // 2. Job id from the URL: currentJobId, else /jobs/view/<id> in the path.
  const fromQuery = url.searchParams.get('currentJobId')
  const fromPath = patterns.jobIdFromPath.exec(url.pathname)?.[1]
  const jobUrl: JobUrl =
    fromQuery !== null && /^\d+$/.test(fromQuery)
      ? { jobId: fromQuery, source: 'currentJobId' }
      : fromPath !== undefined
        ? { jobId: fromPath, source: 'path' }
        : { jobId: '', source: 'path' }
  const finish = withIdentity(jobUrl, 'unknown')
  if (jobUrl.jobId === '') return finish(false, 'no_job_id')

  // 3. JSON-LD (opportunistic). Expected absent on signed-in pages; when
  //    found it supplies fields, but the description still comes from the
  //    block walker over the live DOM.
  const jsonld = readJsonldJobPosting(doc, jobUrl.jobId, health)

  // 4. Layout detection. `unknown_layout` only when neither layout's markers
  //    exist; a matching JobPosting script alone is the jsonld layout.
  const detected = detectLayout(doc, health)
  if (detected === null) {
    if (jsonld === null) return finish(false, 'unknown_layout')
    // No DOM markers: no detail root, so no description can be walked.
    return withIdentity(jobUrl, 'jsonld')(false, 'no_description')
  }
  const layout: Layout = detected
  const done = withIdentity(jobUrl, layout)

  // 5. Detail root. Never `main` or `document.body`.
  const root: Element | Document =
    layout === 'sdui'
      ? (sduiDetailRoot(doc, health) ?? doc)
      : classicDetailRoot(doc, health)

  // 6. Stale-pane guard: the pane's job id must equal the URL job id. A pane
  //    with no id at all is the same "still loading" state.
  const paneId =
    layout === 'sdui'
      ? sduiPaneJobId(root, health)
      : classicPaneJobId(root, health)
  found.paneJobId = paneId ?? undefined
  if (paneId !== jobUrl.jobId) return done(false, 'stale_pane')

  // 7. Fields, in fallback order (docs/spec.md §5.2 step 7).
  const titleSegments = docTitleSegments(doc)

  const description = readDescription(root, layout, jobUrl.jobId, health)
  if (description === null) return done(false, 'no_description')
  found.description = description

  const title = readTitle(root, layout, titleSegments, jsonld, health)
  if (title === null) return done(false, 'no_title')
  found.title = title

  const companyRead = readCompany(root, layout, titleSegments, jsonld, health)
  found.company = companyRead.company
  found.location = readLocation(root, layout, title, jsonld, health)
  found.workplaceType = readWorkplaceType(root, layout, health)

  // 8. Loud failure (docs/spec.md §5.5): nothing is scored from an
  //    unreliable read.
  if (companyRead.mismatch) return done(false, 'company_mismatch')
  const lowConfidencePair =
    description.selector === selectors.sdui.description.longestBox &&
    title.selector === stepLabels.titleFromDocTitle
  if (lowConfidencePair) return done(false, 'low_confidence_fields')
  if (
    description.charCount < minDescriptionChars ||
    description.blocks.length < minDescriptionBlocks
  ) {
    return done(false, 'description_too_short')
  }

  return done(true)
}

// --- layout detection -------------------------------------------------------

function detectLayout(doc: Document, health: SelectorHit[]): Layout | null {
  const steps: readonly (readonly ['sdui' | 'classic', string])[] = [
    ['sdui', selectors.layout.sduiScreen],
    ['sdui', selectors.layout.sduiComponent],
    ['sdui', selectors.layout.jobDetailsKey],
    ['classic', selectors.layout.classicTitle],
    ['classic', selectors.layout.classicDescription],
  ]
  for (const [value, selector] of steps) {
    const matched = doc.querySelectorAll(selector).length
    health.push({ field: 'layout', selector, matched })
    if (matched > 0) return value
  }
  return null
}

// --- detail roots -----------------------------------------------------------

function sduiDetailRoot(doc: Document, health: SelectorHit[]): Element | null {
  for (const selector of [
    selectors.sdui.detailRoot.semanticJobDetails,
    selectors.sdui.detailRoot.jobDetails,
  ]) {
    const el = doc.querySelector(selector)
    health.push({ field: 'detailRoot', selector, matched: el ? 1 : 0 })
    if (el) return el
  }
  // The fallback the standalone page needs: the nearest common ancestor of
  // the JobDetails_* components. They carry the pane's job id, which differs
  // from the URL id exactly in the stale state step 6 catches, so they are
  // collected without filtering by the URL id.
  const keyed = Array.from(doc.querySelectorAll(selectors.layout.jobDetailsKey))
  health.push({
    field: 'detailRoot',
    selector: stepLabels.commonAncestor,
    matched: keyed.length,
  })
  if (keyed.length === 0) return null
  return nearestCommonAncestor(keyed)
}

function nearestCommonAncestor(elements: readonly Element[]): Element | null {
  const chains: Set<Element>[] = elements.map((el) => {
    const chain = new Set<Element>()
    for (let node = el.parentElement; node; node = node.parentElement) {
      chain.add(node)
    }
    return chain
  })
  const first = chains[0]
  if (first === undefined) return null
  for (const candidate of first) {
    if (chains.every((chain) => chain.has(candidate))) return candidate
  }
  return null
}

function classicDetailRoot(doc: Document, health: SelectorHit[]): Document {
  for (const selector of [
    selectors.classic.detailRoot.jobDetails,
    selectors.classic.detailRoot.detail,
  ]) {
    const matched = doc.querySelectorAll(selector).length
    health.push({ field: 'detailRoot', selector, matched })
    if (matched > 0) return doc
  }
  // Neither wrapper exists: the field selectors below scope themselves.
  return doc
}

// --- pane job ids -----------------------------------------------------------

function sduiPaneJobId(
  root: Element | Document,
  health: SelectorHit[],
): string | null {
  const key =
    root.querySelector(selectors.sdui.paneKey)?.getAttribute('componentkey') ??
    null
  const id = key === null ? undefined : patterns.paneKeySuffix.exec(key)?.[1]
  health.push({
    field: 'paneJobId',
    selector: stepLabels.sduiPaneKey,
    matched: id !== undefined ? 1 : 0,
  })
  return id ?? null
}

function classicPaneJobId(
  root: Element | Document,
  health: SelectorHit[],
): string | null {
  const href =
    root
      .querySelector(selectors.classic.pane.titleLink)
      ?.getAttribute('href') ?? null
  const fromLink =
    href === null ? undefined : patterns.jobIdFromPath.exec(href)?.[1]
  health.push({
    field: 'paneJobId',
    selector: stepLabels.classicPaneLink,
    matched: fromLink !== undefined ? 1 : 0,
  })
  if (fromLink !== undefined) return fromLink
  const fromApply =
    root
      .querySelector(selectors.classic.pane.applyButton)
      ?.getAttribute('data-job-id') ?? null
  health.push({
    field: 'paneJobId',
    selector: stepLabels.classicPaneApply,
    matched: fromApply !== null ? 1 : 0,
  })
  return fromApply
}

// --- fields -----------------------------------------------------------------

function readDescription(
  root: Element | Document,
  layout: Layout,
  jobId: string,
  health: SelectorHit[],
): Description | null {
  if (layout === 'sdui') {
    for (const selector of [
      jobScopedDescription(jobId),
      selectors.sdui.description.aboutTheJob,
    ]) {
      const el = root.querySelector(selector)
      health.push({
        field: 'description',
        selector,
        matched: el ? 1 : 0,
      })
      if (el) return walkDescription(el, selector, false)
    }
    // Last resort: the longest expandable box in the detail root (the
    // description is thousands of characters; "About the company" ~330).
    const boxes = Array.from(
      root.querySelectorAll(selectors.sdui.description.longestBox),
    )
    health.push({
      field: 'description',
      selector: selectors.sdui.description.longestBox,
      matched: boxes.length,
    })
    const longest = boxes.reduce<Element | null>(
      (best, el) =>
        best === null || el.textContent.length > best.textContent.length
          ? el
          : best,
      null,
    )
    return longest === null
      ? null
      : walkDescription(longest, selectors.sdui.description.longestBox, false)
  }
  if (layout === 'classic') {
    for (const selector of [
      selectors.classic.description.jobDetails,
      selectors.classic.description.contentBox,
      selectors.classic.description.htmlContent,
      selectors.classic.description.stretch,
    ]) {
      const el = root.querySelector(selector)
      health.push({ field: 'description', selector, matched: el ? 1 : 0 })
      if (el) return walkDescription(el, selector, true)
    }
  }
  return null
}

function walkDescription(
  el: Element,
  selector: string,
  dropLeadingAboutTheJob: boolean,
): Description {
  let blocks = walkBlocks(el)
  // The classic description box opens with its own "About the job" heading,
  // which is page chrome, not posting content.
  const first = blocks[0]
  if (dropLeadingAboutTheJob && first?.kind === 'heading') {
    if (patterns.leadingAboutTheJob.test(first.text)) blocks = blocks.slice(1)
  }
  return { blocks, charCount: charCountOf(blocks), selector }
}

function docTitleSegments(doc: Document): string[] {
  const raw = doc.title.split(patterns.titleSeparator)
  const seg1 = (raw[0] ?? '').replace(patterns.docTitleCountPrefix, '')
  // Segment 2 is a company name only in the 3-part "Title | Company |
  // LinkedIn" shape; in shorter titles it is "LinkedIn" or absent.
  return raw.length >= 3 ? [seg1, raw[1] ?? ''] : [seg1]
}

function readTitle(
  root: Element | Document,
  layout: Layout,
  titleSegments: readonly string[],
  jsonld: JsonldJob | null,
  health: SelectorHit[],
): Field | null {
  const seg1 = titleSegments[0] ?? ''
  if (layout === 'sdui') {
    if (seg1 !== '') {
      // The top card sits outside every data-sdui-component; its title
      // element carries exactly the document.title text.
      const el = firstByText(root, seg1)
      health.push({
        field: 'title',
        selector: stepLabels.sduiTitleByText,
        matched: el ? 1 : 0,
      })
      if (el !== null) {
        return {
          value: seg1,
          selector: stepLabels.sduiTitleByText,
          confidence: 'high',
        }
      }
      return {
        value: seg1,
        selector: stepLabels.titleFromDocTitle,
        confidence: 'low',
      }
    }
    health.push({
      field: 'title',
      selector: stepLabels.titleFromDocTitle,
      matched: 0,
    })
  } else if (layout === 'classic') {
    // Never document.title on classic: it is a generic list title there.
    for (const selector of [
      selectors.classic.title.topCard,
      selectors.classic.title.t24,
      selectors.classic.title.anyH1,
    ]) {
      const el = root.querySelector(selector)
      const value = el === null ? '' : normalizeText(el.textContent)
      health.push({ field: 'title', selector, matched: value !== '' ? 1 : 0 })
      if (value !== '') return { value, selector, confidence: 'high' }
    }
  }
  if (jsonld?.title !== undefined) {
    health.push({
      field: 'title',
      selector: stepLabels.jsonldTitle,
      matched: 1,
    })
    return {
      value: jsonld.title,
      selector: stepLabels.jsonldTitle,
      confidence: 'low',
    }
  }
  return null
}

function readCompany(
  root: Element | Document,
  layout: Layout,
  titleSegments: readonly string[],
  jsonld: JsonldJob | null,
  health: SelectorHit[],
): { company: Field | undefined; mismatch: boolean } {
  const seg2 = titleSegments[1] ?? ''
  if (layout === 'sdui') {
    // The company link in the top card, outside every data-sdui-component.
    const fromLink =
      Array.from(root.querySelectorAll(selectors.sdui.companyLink))
        .filter((a) => a.closest('[data-sdui-component]') === null)
        .map((a) => normalizeText(a.textContent))
        .find((text) => text !== '') ?? null
    health.push({
      field: 'company',
      selector: selectors.sdui.companyLink,
      matched: fromLink !== null ? 1 : 0,
    })
    const fromTitle = seg2 !== '' ? seg2 : null
    health.push({
      field: 'company',
      selector: stepLabels.companyFromDocTitle,
      matched: fromTitle !== null ? 1 : 0,
    })
    // Cross-check the two sources (docs/spec.md §5.5).
    const mismatch =
      fromLink !== null && fromTitle !== null && fromLink !== fromTitle
    const value = fromLink ?? fromTitle ?? jsonld?.company
    if (value === undefined) return { company: undefined, mismatch }
    if (fromLink === null && fromTitle === null) {
      health.push({
        field: 'company',
        selector: stepLabels.jsonldCompany,
        matched: 1,
      })
      return {
        company: {
          value,
          selector: stepLabels.jsonldCompany,
          confidence: 'low',
        },
        mismatch,
      }
    }
    return {
      company: {
        value,
        selector:
          fromLink !== null
            ? selectors.sdui.companyLink
            : stepLabels.companyFromDocTitle,
        confidence: fromLink !== null ? 'high' : 'low',
      },
      mismatch,
    }
  }
  if (layout === 'classic') {
    for (const selector of [
      selectors.classic.company.link,
      selectors.classic.company.container,
    ]) {
      const el = root.querySelector(selector)
      const value = el === null ? '' : normalizeText(el.textContent)
      health.push({ field: 'company', selector, matched: value !== '' ? 1 : 0 })
      if (value !== '') {
        return {
          company: { value, selector, confidence: 'high' },
          mismatch: false,
        }
      }
    }
  }
  if (jsonld?.company !== undefined) {
    health.push({
      field: 'company',
      selector: stepLabels.jsonldCompany,
      matched: 1,
    })
    return {
      company: {
        value: jsonld.company,
        selector: stepLabels.jsonldCompany,
        confidence: 'low',
      },
      mismatch: false,
    }
  }
  return { company: undefined, mismatch: false }
}

function readLocation(
  root: Element | Document,
  layout: Layout,
  title: Field,
  jsonld: JsonldJob | null,
  health: SelectorHit[],
): Field | undefined {
  if (layout === 'sdui') {
    // First span of the first `p` after the title that contains `·`, in the
    // top card (outside every data-sdui-component). Position-based, so medium.
    const paragraphs = Array.from(root.querySelectorAll('p')).filter(
      (p) => p.closest('[data-sdui-component]') === null,
    )
    const titleEl = firstByText(root, title.value)
    const afterTitle =
      titleEl === null ? paragraphs : paragraphs.filter(follows(titleEl))
    const line = afterTitle.find((p) => p.textContent.includes('·'))
    const value = normalizeText(line?.querySelector('span')?.textContent ?? '')
    health.push({
      field: 'location',
      selector: stepLabels.sduiLocation,
      matched: value !== '' ? 1 : 0,
    })
    if (value !== '') {
      return { value, selector: stepLabels.sduiLocation, confidence: 'medium' }
    }
  } else if (layout === 'classic') {
    for (const selector of [
      selectors.classic.location.primary,
      selectors.classic.location.tertiary,
    ]) {
      const el = root.querySelector(selector)
      const value = el === null ? '' : normalizeText(el.textContent)
      health.push({
        field: 'location',
        selector,
        matched: value !== '' ? 1 : 0,
      })
      if (value !== '') return { value, selector, confidence: 'high' }
    }
  }
  if (jsonld?.location !== undefined) {
    health.push({
      field: 'location',
      selector: stepLabels.jsonldLocation,
      matched: 1,
    })
    return {
      value: jsonld.location,
      selector: stepLabels.jsonldLocation,
      confidence: 'low',
    }
  }
  return undefined
}

function follows(anchor: Element): (other: Element) => boolean {
  return (other) =>
    (anchor.compareDocumentPosition(other) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
}

function readWorkplaceType(
  root: Element | Document,
  layout: Layout,
  health: SelectorHit[],
): ExtractionResult['workplaceType'] {
  if (layout === 'sdui') {
    // A pill in the top-card region: exact text match, English-only.
    const pill = Array.from(root.querySelectorAll('a, span'))
      .filter((el) => el.closest('[data-sdui-component]') === null)
      .find((el) => patterns.workplaceExact.test(normalizeText(el.textContent)))
    const value = pill === undefined ? null : normalizeText(pill.textContent)
    health.push({
      field: 'workplaceType',
      selector: stepLabels.sduiWorkplace,
      matched: value !== null ? 1 : 0,
    })
    if (value !== null && patterns.workplaceExact.test(value)) {
      return value as 'Remote' | 'Hybrid' | 'On-site'
    }
    return 'unknown'
  }
  if (layout === 'classic') {
    const strongs = Array.from(
      root.querySelectorAll(selectors.classic.workplace),
    )
    health.push({
      field: 'workplaceType',
      selector: stepLabels.classicWorkplace,
      matched: strongs.length,
    })
    for (const strong of strongs) {
      const match = patterns.workplaceContained.exec(strong.textContent)
      if (match !== null) return match[0] as 'Remote' | 'Hybrid' | 'On-site'
    }
    return 'unknown'
  }
  return 'unknown'
}

// --- helpers ----------------------------------------------------------------

/** The first element in the root, outside every data-sdui-component, whose
 *  normalized text equals `text`. */
function firstByText(root: Element | Document, text: string): Element | null {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.closest('[data-sdui-component]') !== null) continue
    if (normalizeText(el.textContent) === text) return el
  }
  return null
}

// --- JSON-LD (opportunistic) --------------------------------------------------

interface JsonldJob {
  title?: string
  company?: string
  location?: string
}

/** Parse `script[type="application/ld+json"]` blocks and return the first
 *  JobPosting whose URL or identifier matches this job. Never throws: JSON-LD
 *  is opportunistic and expected absent on signed-in pages. */
function readJsonldJobPosting(
  doc: Document,
  jobId: string,
  health: SelectorHit[],
): JsonldJob | null {
  let matched = 0
  let found: JsonldJob | null = null
  for (const script of Array.from(doc.querySelectorAll(selectors.jsonld))) {
    let data: unknown
    try {
      data = JSON.parse(script.textContent)
    } catch {
      continue
    }
    for (const node of jobPostingNodes(data)) {
      if (!jsonldMatchesJob(node, jobId)) continue
      matched++
      found = {
        title: nonEmpty(jsonldString(node.title)),
        company: nonEmpty(jsonldString(node.hiringOrganization?.name)),
        location: jsonldLocationText(node.jobLocation),
      }
      break
    }
    if (found !== null) break
  }
  health.push({ field: 'jsonld', selector: selectors.jsonld, matched })
  return found
}

interface JsonldNode {
  '@type'?: unknown
  title?: unknown
  url?: unknown
  identifier?: unknown
  hiringOrganization?: { name?: unknown } | null
  jobLocation?: unknown
}

/** Collect JobPosting nodes from a parsed JSON-LD block, following @graph. */
function jobPostingNodes(data: unknown): JsonldNode[] {
  if (Array.isArray(data)) return data.flatMap(jobPostingNodes)
  if (typeof data !== 'object' || data === null) return []
  const record = data as Record<string, unknown> & JsonldNode
  const graph = record['@graph']
  const nodes = graph === undefined ? [] : jobPostingNodes(graph)
  const type = record['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.includes('JobPosting')) nodes.push(record)
  return nodes
}

function jsonldMatchesJob(node: JsonldNode, jobId: string): boolean {
  const identifiers = Array.isArray(node.identifier)
    ? node.identifier
    : node.identifier === undefined
      ? []
      : [node.identifier]
  const identifierMatch = identifiers.some((identifier) => {
    const value =
      typeof identifier === 'string'
        ? identifier
        : typeof identifier === 'object' && identifier !== null
          ? jsonldString((identifier as { value?: unknown }).value)
          : undefined
    return value?.includes(jobId)
  })
  if (identifierMatch) return true
  const url = jsonldString(node.url)
  return url?.includes(jobId) ?? false
}

function jsonldString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function jsonldLocationText(value: unknown): string | undefined {
  const locations = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value]
  for (const location of locations) {
    if (typeof location === 'string') {
      const text = nonEmpty(location)
      if (text !== undefined) return text
      continue
    }
    if (typeof location !== 'object' || location === null) continue
    const address = (location as { address?: unknown }).address
    if (typeof address !== 'object' || address === null) continue
    const parts = ['addressLocality', 'addressRegion', 'addressCountry']
      .map((key) => jsonldString((address as Record<string, unknown>)[key]))
      .filter((part): part is string => part !== undefined)
      .map(normalizeText)
      .filter((part) => part !== '')
    if (parts.length > 0) return parts.join(', ')
  }
  return undefined
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value === undefined ? '' : normalizeText(value)
  return normalized === '' ? undefined : normalized
}
