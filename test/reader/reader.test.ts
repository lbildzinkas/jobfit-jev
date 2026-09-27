// Reader tests against the three sanitized fixtures (docs/spec.md §11.1):
// layout detection, every field through its expected selector, the stale-pane
// guard, and the negative cases produced by mutating a fixture in the test.

import { describe, expect, it } from 'vitest'
import { extractJobPosting } from '../../src/reader/reader'
import {
  jobScopedDescription,
  selectors,
  stepLabels,
} from '../../src/reader/selectors'
import {
  fixtureCases,
  fixtureJobId,
  fixtureUrl,
  loadFixture,
  staleJobId,
  syntheticDocument,
  type FixtureName,
} from './fixtures'

const sduiFixtures: FixtureName[] = ['search', 'standalone']

describe('layout detection', () => {
  it.each(Object.keys(fixtureCases) as FixtureName[])(
    '%s is detected as %s',
    (name) => {
      const doc = loadFixture(name)
      const result = extractJobPosting(doc, fixtureUrl(name))
      expect(result.layout).toBe(fixtureCases[name].layout)
      expect(result.ok).toBe(true)
    },
  )

  it('detects the standalone page through the fallback markers', () => {
    const doc = loadFixture('standalone')
    // The main-only capture drops data-sdui-screen (linkedin-structure §3.1).
    expect(doc.querySelectorAll(selectors.layout.sduiScreen)).toHaveLength(0)
    expect(
      doc.querySelectorAll(selectors.layout.sduiComponent).length,
    ).toBeGreaterThan(0)
    const result = extractJobPosting(doc, fixtureUrl('standalone'))
    expect(result.layout).toBe('sdui')
  })
})

describe('url and pane identity', () => {
  it('reads the job id from currentJobId on the two-pane pages', () => {
    for (const name of ['search', 'classic'] as FixtureName[]) {
      const result = extractJobPosting(loadFixture(name), fixtureUrl(name))
      expect(result.url).toEqual({
        jobId: fixtureJobId,
        source: 'currentJobId',
      })
      expect(result.paneJobId).toBe(fixtureJobId)
    }
  })

  it('reads the job id from the path on the standalone page', () => {
    const result = extractJobPosting(
      loadFixture('standalone'),
      fixtureUrl('standalone'),
    )
    expect(result.url).toEqual({ jobId: fixtureJobId, source: 'path' })
    expect(result.paneJobId).toBe(fixtureJobId)
  })
})

describe('fields on the SDUI layouts', () => {
  it.each(sduiFixtures)(
    '%s finds every field through its expected selector',
    (name) => {
      const doc = loadFixture(name)
      const result = extractJobPosting(doc, fixtureUrl(name))
      expect(result.ok).toBe(true)

      const segments = doc.title.split(' | ')
      const company = result.company
      const location = result.location

      expect(result.title).toEqual({
        value: segments[0],
        selector: stepLabels.sduiTitleByText,
        confidence: 'high',
      })
      expect(company).toEqual({
        value: segments[1],
        selector: selectors.sdui.companyLink,
        confidence: 'high',
      })
      expect(location?.selector).toBe(stepLabels.sduiLocation)
      expect(location?.confidence).toBe('medium')
      expect(location?.value.length).toBeGreaterThan(0)
      expect(result.workplaceType).toBe('Remote')
      expect(result.description).toBeDefined()
      expect(result.description?.selector).toBe(
        jobScopedDescription(fixtureJobId),
      )
      expect(result.description?.blocks.length).toBeGreaterThanOrEqual(3)
      expect(result.description?.charCount).toBeGreaterThanOrEqual(300)
    },
  )
})

describe('fields on the classic layout', () => {
  it('finds every field through its expected selector', () => {
    const doc = loadFixture('classic')
    const result = extractJobPosting(doc, fixtureUrl('classic'))
    expect(result.ok).toBe(true)

    expect(result.title?.selector).toBe(selectors.classic.title.topCard)
    expect(result.title?.confidence).toBe('high')
    expect(result.title?.value.length).toBeGreaterThan(0)
    // The classic page title is a generic list title and must never be used.
    expect(result.title?.value).not.toBe(doc.title.split(' | ')[0])

    expect(result.company?.selector).toBe(selectors.classic.company.link)
    expect(result.company?.confidence).toBe('high')
    expect(result.company?.value.length).toBeGreaterThan(0)

    expect(result.location?.selector).toBe(selectors.classic.location.primary)
    expect(result.location?.confidence).toBe('high')
    expect(result.location?.value.length).toBeGreaterThan(0)

    expect(result.workplaceType).toBe('Hybrid')

    const description = result.description
    expect(description?.selector).toBe(selectors.classic.description.jobDetails)
    expect(description?.blocks.length).toBeGreaterThanOrEqual(3)
    expect(description?.charCount).toBeGreaterThanOrEqual(300)
    // The leading "About the job" heading is page chrome, not content.
    expect(
      description?.blocks[0]?.kind === 'heading' &&
        /^about the job$/i.test(description.blocks[0].text),
    ).toBe(false)
  })
})

describe('health log', () => {
  it('records every selector tried, in order', () => {
    const doc = loadFixture('search')
    const result = extractJobPosting(doc, fixtureUrl('search'))
    const fields = result.health.map((hit) => hit.field)
    expect(fields).toEqual([
      'jsonld',
      'layout',
      'detailRoot',
      'paneJobId',
      'description',
      'title',
      'company',
      'company',
      'location',
      'workplaceType',
    ])
    const descriptionHits = result.health.filter(
      (hit) => hit.field === 'description',
    )
    expect(descriptionHits[0]).toEqual({
      field: 'description',
      selector: jobScopedDescription(fixtureJobId),
      matched: 1,
    })
  })

  it('shows which selector matched when a fallback fires', () => {
    const doc = loadFixture('standalone')
    // The standalone capture drops data-sdui-screen, so the detail root
    // reaches the common-ancestor fallback.
    const result = extractJobPosting(doc, fixtureUrl('standalone'))
    const rootHits = result.health.filter((hit) => hit.field === 'detailRoot')
    expect(rootHits.map((hit) => hit.selector)).toEqual([
      selectors.sdui.detailRoot.semanticJobDetails,
      selectors.sdui.detailRoot.jobDetails,
      stepLabels.commonAncestor,
    ])
    expect(rootHits[2]?.matched).toBeGreaterThan(0)
  })
})

describe('stale-pane guard', () => {
  it.each(Object.keys(fixtureCases) as FixtureName[])(
    '%s fails loudly when the URL job id differs from the pane',
    (name) => {
      const doc = loadFixture(name, staleJobId)
      const result = extractJobPosting(doc, fixtureUrl(name, staleJobId))
      expect(result.ok).toBe(false)
      expect(result.failure).toBe('stale_pane')
      expect(result.url.jobId).toBe(staleJobId)
      expect(result.paneJobId).toBe(fixtureJobId)
    },
  )
})

describe('negative cases', () => {
  it('fails with no_description when the description is gone (SDUI)', () => {
    const doc = loadFixture('search')
    for (const box of Array.from(
      doc.querySelectorAll('[data-testid="expandable-text-box"]'),
    )) {
      box.remove()
    }
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('no_description')
  })

  it('fails with no_description when the description is gone (classic)', () => {
    const doc = loadFixture('classic')
    doc.querySelector('#job-details')?.remove()
    const result = extractJobPosting(doc, fixtureUrl('classic'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('no_description')
  })

  it('fails with stale_pane when the pane carries no job id', () => {
    const doc = loadFixture('search')
    for (const el of Array.from(
      doc.querySelectorAll('[componentkey^="JobDetails_AboutTheJob_"]'),
    )) {
      el.removeAttribute('componentkey')
    }
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('stale_pane')
    expect(result.paneJobId).toBeUndefined()
  })

  it('fails with unknown_layout when every SDUI marker is stripped', () => {
    const doc = loadFixture('search')
    for (const el of Array.from(doc.querySelectorAll('[data-sdui-screen]'))) {
      el.removeAttribute('data-sdui-screen')
    }
    for (const el of Array.from(
      doc.querySelectorAll('[data-sdui-component]'),
    )) {
      el.removeAttribute('data-sdui-component')
    }
    for (const el of Array.from(doc.querySelectorAll('[componentkey]'))) {
      el.removeAttribute('componentkey')
    }
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('unknown_layout')
    expect(result.layout).toBe('unknown')
  })

  it('fails with description_too_short below the 300-char floor', () => {
    const doc = loadFixture('search')
    const box = doc.querySelector(
      '[data-sdui-component$=".aboutTheJob"] [data-testid="expandable-text-box"]',
    )
    box?.replaceChildren(doc.createTextNode('Short description.'))
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('description_too_short')
    expect(result.description?.charCount).toBeLessThan(300)
  })

  it('fails with not_linkedin_job outside linkedin jobs', () => {
    const doc = loadFixture('search')
    expect(
      extractJobPosting(doc, 'https://example.com/jobs/view/1000000001/')
        .failure,
    ).toBe('not_linkedin_job')
    expect(
      extractJobPosting(doc, 'https://www.linkedin.com/feed/').failure,
    ).toBe('not_linkedin_job')
    expect(extractJobPosting(doc, 'not a url').failure).toBe('not_linkedin_job')
  })

  it('fails with no_job_id when the URL holds none', () => {
    const doc = loadFixture('search')
    const result = extractJobPosting(
      doc,
      'https://www.linkedin.com/jobs/search-results/',
    )
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('no_job_id')
    expect(result.url.jobId).toBe('')
  })
})

describe('loud-failure combinations', () => {
  const descriptionHtml = `<br><br>${'You will build reliable software for years. '.repeat(12)}<br><br>Second block of the description.<br><br>Third block.`

  function sduiPage(body: string, title: string): Document {
    return syntheticDocument(
      `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=1000000001',
    )
  }

  it('fails with company_mismatch when the two company sources disagree', () => {
    const doc = sduiPage(
      `
      <div data-sdui-screen="x.SemanticJobDetails">
        <p>Engineer</p>
        <a href="/company/example-co/life/">Example Co</a>
        <div componentkey="JobDetails_AboutTheJob_1000000001">
          <span data-testid="expandable-text-box">${descriptionHtml}</span>
        </div>
      </div>
      `,
      'Engineer | Other Co | LinkedIn',
    )
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('company_mismatch')
  })

  it('fails with low_confidence_fields when description and title are both guesses', () => {
    const doc = sduiPage(
      `
      <div data-sdui-screen="x.SemanticJobDetails">
        <div componentkey="JobDetails_AboutTheJob_1000000001"></div>
        <span data-testid="expandable-text-box">${descriptionHtml}</span>
      </div>
      `,
      'Engineer | Example Co | LinkedIn',
    )
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('low_confidence_fields')
    expect(result.description?.selector).toBe(
      selectors.sdui.description.longestBox,
    )
    expect(result.title?.selector).toBe(stepLabels.titleFromDocTitle)
  })
})

describe('JSON-LD (opportunistic)', () => {
  const jsonldScript = `
    <script type="application/ld+json">
      {"@type":"JobPosting","title":"Engineer","identifier":{"value":"1000000001"},
       "hiringOrganization":{"name":"Example Co"},
       "jobLocation":{"address":{"addressLocality":"Example City","addressCountry":"Exampleland"}}}
    </script>`
  const descriptionHtml = `<br><br>${'You will build reliable software for years. '.repeat(12)}<br><br>Second block of the description.<br><br>Third block.`

  it('supplies fields the DOM selectors could not find', () => {
    // No /company/ link, and a two-part page title, so both company sources
    // are empty and JSON-LD is the only supplier left.
    const doc = syntheticDocument(
      `<!doctype html><html><head><title>Engineer | LinkedIn</title></head><body>
        <div data-sdui-screen="x.SemanticJobDetails">
          <p>Engineer</p>
          <div componentkey="JobDetails_AboutTheJob_1000000001">
            <span data-testid="expandable-text-box">${descriptionHtml}</span>
          </div>
        </div>
        ${jsonldScript}
      </body></html>`,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=1000000001',
    )
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(true)
    expect(result.company).toEqual({
      value: 'Example Co',
      selector: stepLabels.jsonldCompany,
      confidence: 'low',
    })
  })

  it('matches a JobPosting that carries only a title', () => {
    // No identifier or url: only the title criterion can match, against
    // document.title segment 1 with the "(3) " count prefix stripped.
    const doc = syntheticDocument(
      `<!doctype html><html><head><title>(3) Engineer | LinkedIn</title></head><body>
        <div data-sdui-screen="x.SemanticJobDetails">
          <p>Engineer</p>
          <div componentkey="JobDetails_AboutTheJob_1000000001">
            <span data-testid="expandable-text-box">${descriptionHtml}</span>
          </div>
        </div>
        <script type="application/ld+json">
          {"@type":"JobPosting","title":"Engineer","hiringOrganization":{"name":"Example Co"}}
        </script>
      </body></html>`,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=1000000001',
    )
    const result = extractJobPosting(doc, fixtureUrl('search'))
    expect(result.ok).toBe(true)
    expect(result.company).toEqual({
      value: 'Example Co',
      selector: stepLabels.jsonldCompany,
      confidence: 'low',
    })
  })

  it('is the layout when no DOM markers exist', () => {
    const doc = syntheticDocument(
      `<!doctype html><html><head><title>Engineer</title></head><body>${jsonldScript}</body></html>`,
      'https://www.linkedin.com/jobs/view/1000000001/',
    )
    const result = extractJobPosting(
      doc,
      'https://www.linkedin.com/jobs/view/1000000001/',
    )
    expect(result.layout).toBe('jsonld')
    // The description always comes from the DOM block walker, never JSON-LD.
    expect(result.ok).toBe(false)
    expect(result.failure).toBe('no_description')
  })

  it('is ignored when it does not match the job', () => {
    const doc = syntheticDocument(
      `<!doctype html><html><head><title>Engineer</title></head><body>
        <script type="application/ld+json">{"@type":"JobPosting","identifier":{"value":"9999999999"}}</script>
      </body></html>`,
      'https://www.linkedin.com/jobs/view/1000000001/',
    )
    const result = extractJobPosting(
      doc,
      'https://www.linkedin.com/jobs/view/1000000001/',
    )
    expect(result.layout).toBe('unknown')
    expect(result.failure).toBe('unknown_layout')
  })
})
