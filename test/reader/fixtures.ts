// Fixture loading for the reader tests (docs/spec.md §11.1). The fixtures are
// sanitized XHTML and MUST be parsed as `application/xhtml+xml`: SDUI nests
// `ul` inside `p > span`, which an HTML parser silently moves out of the
// description box (docs/linkedin-structure.md §7).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

export type FixtureName = keyof typeof fixtureCases

export const fixtureCases = {
  search: {
    file: 'sdui-search-results-two-pane.xhtml',
    url: 'https://www.linkedin.com/jobs/search-results/?currentJobId=1000000001',
    layout: 'sdui',
  },
  standalone: {
    file: 'sdui-job-view-standalone.xhtml',
    url: 'https://www.linkedin.com/jobs/view/1000000001/',
    layout: 'sdui',
  },
  classic: {
    file: 'classic-collections-recommended-two-pane.xhtml',
    url: 'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1000000001',
    layout: 'classic',
  },
} as const

/** The job id every fixture was sanitized to use. */
export const fixtureJobId = '1000000001'

/** The id used to force the stale-pane state (differs from every pane id). */
export const staleJobId = '1000000002'

export function fixtureUrl(name: FixtureName, jobId = fixtureJobId): string {
  const url = new URL(fixtureCases[name].url)
  if (name === 'standalone') {
    url.pathname = `/jobs/view/${jobId}/`
  } else {
    url.searchParams.set('currentJobId', jobId)
  }
  return url.href
}

export function loadFixture(name: FixtureName, jobId = fixtureJobId): Document {
  const path = resolve(
    import.meta.dirname,
    '../fixtures/linkedin',
    fixtureCases[name].file,
  )
  const src = readFileSync(path, 'utf8')
  return new JSDOM(src, {
    contentType: 'application/xhtml+xml',
    url: fixtureUrl(name, jobId),
  }).window.document
}

/** The same fixture parsed as HTML, for the re-parse regression trap. */
export function loadFixtureAsHtml(name: FixtureName): Document {
  const path = resolve(
    import.meta.dirname,
    '../fixtures/linkedin',
    fixtureCases[name].file,
  )
  const src = readFileSync(path, 'utf8')
  return new JSDOM(src, {
    contentType: 'text/html',
    url: fixtureCases[name].url,
  }).window.document
}

/** A fresh document built from an HTML string (for synthetic pages). */
export function syntheticDocument(html: string, url: string): Document {
  return new JSDOM(html, { contentType: 'text/html', url }).window.document
}
