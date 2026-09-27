// Block walker tests (docs/spec.md §5.2 step 8, §11.1): structure
// preservation, block kinds, and the regression test for the HTML re-parse
// trap that silently moves the SDUI description's `ul` lists out of the box.

import { describe, expect, it } from 'vitest'
import { selectors } from '../../src/reader/selectors'
import { charCountOf, walkBlocks } from '../../src/reader/walker'
import { loadFixture, loadFixtureAsHtml, syntheticDocument } from './fixtures'

function walkSynthetic(html: string) {
  const box = syntheticDocument(
    `<!doctype html><html><body><div id="box">${html}</div></body></html>`,
    'https://www.linkedin.com/jobs/view/1/',
  ).querySelector('#box')
  if (box === null) throw new Error('synthetic box missing')
  return walkBlocks(box)
}

describe('block kinds', () => {
  it('splits paragraphs on br runs', () => {
    const blocks = walkSynthetic('First line.<br><br>Second line.')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'First line.' },
      { kind: 'paragraph', text: 'Second line.' },
    ])
  })

  it('turns a strong-only paragraph into a heading', () => {
    const blocks = walkSynthetic(
      '<strong>Minimum qualifications</strong><br>text',
    )
    expect(blocks[0]).toEqual({
      kind: 'heading',
      text: 'Minimum qualifications',
    })
  })

  it('turns a paragraph ending with a colon into a heading', () => {
    const blocks = walkSynthetic('What you will do:<br>text')
    expect(blocks[0]).toEqual({ kind: 'heading', text: 'What you will do:' })
  })

  it('keeps mixed strong-and-text paragraphs as paragraphs', () => {
    const blocks = walkSynthetic('You know <strong>Python</strong> well.<br>x')
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      text: 'You know Python well.',
    })
  })

  it('emits h1-h4 as headings', () => {
    const blocks = walkSynthetic('<h3>Section</h3>body')
    expect(blocks[0]).toEqual({ kind: 'heading', text: 'Section' })
    expect(blocks[1]).toEqual({ kind: 'paragraph', text: 'body' })
  })

  it('emits list items as bullets with their nesting depth', () => {
    const blocks = walkSynthetic(
      '<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul>',
    )
    expect(blocks).toEqual([
      { kind: 'bullet', text: 'one', depth: 1 },
      { kind: 'bullet', text: 'two', depth: 1 },
      { kind: 'bullet', text: 'nested', depth: 2 },
    ])
  })

  it('normalizes whitespace without changing the wording', () => {
    const blocks = walkSynthetic('  Spaced   out\t\twords  <br>x')
    expect(blocks[0]?.text).toBe('Spaced out words')
  })
})

describe('the SDUI description fixture', () => {
  const descriptionSelector = selectors.sdui.description.aboutTheJob

  it('keeps the bullets inside the description box (regression)', () => {
    // XHTML parse: the ul elements stay inside p > span, exactly where the
    // live page has them.
    const box = loadFixture('search').querySelector(descriptionSelector)
    if (box === null) throw new Error('description box missing')
    const blocks = walkBlocks(box)
    const bullets = blocks.filter((block) => block.kind === 'bullet')
    expect(bullets.length).toBeGreaterThanOrEqual(20)
    expect(
      blocks.filter((block) => block.kind === 'heading').length,
    ).toBeGreaterThanOrEqual(3)
    expect(charCountOf(blocks)).toBeGreaterThanOrEqual(300)
  })

  it('loses the bullets when the page is re-parsed as HTML (the trap)', () => {
    // Same fixture parsed as text/html: the HTML parser closes the p before
    // the ul and the lists leave the description box. This is why the reader
    // walks live child nodes and never re-parses serialized markup.
    const box = loadFixtureAsHtml('search').querySelector(descriptionSelector)
    if (box === null) throw new Error('description box missing')
    const blocks = walkBlocks(box)
    const bullets = blocks.filter((block) => block.kind === 'bullet')
    expect(bullets).toHaveLength(0)
  })
})
