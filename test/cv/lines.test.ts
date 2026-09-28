// Line rebuilding and scanned-PDF refusal (docs/spec.md §4.3 step 1) on
// positioned text runs.

import { describe, expect, it } from 'vitest'
import {
  buildLines,
  checkTextLayer,
  linesFromText,
} from '../../src/core/cv/lines'
import type { PdfText, TextRun } from '../../src/core/cv/types'

function run(text: string, x: number, y: number, fontSize = 10): TextRun {
  return { text, x, y, width: text.length * fontSize * 0.5, fontSize }
}

function page(...runs: TextRun[]): PdfText {
  return { pages: [{ runs }], hasImageOnFirstPage: false }
}

const texts = (pdf: PdfText) => buildLines(pdf).map((line) => line.text)

describe('buildLines', () => {
  it('orders rows top to bottom and runs left to right', () => {
    const pdf = page(
      run('second line', 72, 680),
      run('world', 110, 700),
      run('Hello', 72, 700),
    )
    expect(texts(pdf)).toEqual(['Hello world', 'second line'])
  })

  it('keeps right-aligned dates on the role line', () => {
    const pdf = page(
      run('Staff Engineer, Northwind', 72, 700),
      run('Jan 2021 – Present', 450, 700),
      run('• Built the ledger service.', 72, 686),
      run('Engineer, Contoso', 72, 660),
      run('2016 – 2020', 470, 660),
    )
    expect(texts(pdf)).toEqual([
      'Staff Engineer, Northwind Jan 2021 – Present',
      '• Built the ledger service.',
      'Engineer, Contoso 2016 – 2020',
    ])
  })

  it('reads a sidebar layout column by column', () => {
    // A left sidebar with contact details beside the main column; the rows
    // of the two columns do not line up.
    const pdf = page(
      run('Contact', 40, 700, 12),
      run('Experience', 220, 702, 12),
      run('Skills', 40, 640, 12),
      run('Staff Engineer, Northwind', 220, 680),
      run('Go, Kafka', 40, 626),
      run('Jan 2021 – Present', 220, 666),
      run('Languages', 40, 600, 12),
      run('• Built the ledger service.', 220, 652),
      run('English', 40, 586),
      run('• Ran the on-call rotation.', 220, 638),
    )
    expect(texts(pdf)).toEqual([
      'Contact',
      'Skills',
      'Go, Kafka',
      'Languages',
      'English',
      'Experience',
      'Staff Engineer, Northwind',
      'Jan 2021 – Present',
      '• Built the ledger service.',
      '• Ran the on-call rotation.',
    ])
  })

  it('keeps a full-width banner above the columns', () => {
    const pdf = page(
      run('Jordan Sample — Senior Software Engineer', 40, 740, 16),
      run('Contact', 40, 700, 12),
      run('Experience', 220, 702, 12),
      run('Skills', 40, 640, 12),
      run('Staff Engineer', 220, 680),
      run('Go', 40, 626),
      run('Jan 2021 – Present', 220, 666),
      run('Languages', 40, 600, 12),
      run('• Built things.', 220, 652),
    )
    const lines = texts(pdf)
    expect(lines[0]).toBe('Jordan Sample — Senior Software Engineer')
    expect(lines.indexOf('Languages')).toBeLessThan(lines.indexOf('Experience'))
  })

  it('joins split words and adds spaces at word gaps', () => {
    const pdf = page(
      run('Kuber', 72, 700),
      run('netes', 97, 700),
      run('and', 130, 700),
    )
    expect(texts(pdf)).toEqual(['Kubernetes and'])
  })

  it('numbers lines across pages in reading order', () => {
    const pdf: PdfText = {
      pages: [{ runs: [run('one', 72, 700)] }, { runs: [run('two', 72, 700)] }],
      hasImageOnFirstPage: false,
    }
    expect(buildLines(pdf)).toEqual([
      { index: 0, page: 1, text: 'one', fontSize: 10 },
      { index: 1, page: 2, text: 'two', fontSize: 10 },
    ])
  })
})

describe('checkTextLayer', () => {
  const longText = 'Backend engineer building payment systems. '.repeat(6)

  it('accepts a PDF with a text layer', () => {
    expect(checkTextLayer(page(run(longText, 72, 700)))).toEqual({ ok: true })
  })

  it('refuses a PDF with almost no text, like a scan', () => {
    expect(checkTextLayer(page(run('Page 1', 72, 20)))).toEqual({
      ok: false,
      reason: 'too_little_text',
    })
  })

  it('refuses when most pages are empty', () => {
    const pdf: PdfText = {
      pages: [{ runs: [run(longText, 72, 700)] }, { runs: [] }, { runs: [] }],
      hasImageOnFirstPage: true,
    }
    expect(checkTextLayer(pdf)).toEqual({
      ok: false,
      reason: 'most_pages_empty',
    })
  })
})

describe('linesFromText', () => {
  it('keeps one line per non-empty text line without font data', () => {
    expect(linesFromText('Summary\r\n\n  Builds   things. \n')).toEqual([
      { index: 0, page: 1, text: 'Summary', fontSize: 0 },
      { index: 1, page: 1, text: 'Builds things.', fontSize: 0 },
    ])
  })
})
