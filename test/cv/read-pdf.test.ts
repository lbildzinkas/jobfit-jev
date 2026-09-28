// @vitest-environment node
// CV import from real PDF bytes: small PDFs generated in the test and read
// with the pdf.js Node.js build, which shares its text extraction with the
// browser build the extension bundles.

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import {
  importPastedText,
  importPdf,
  type ReadPdf,
} from '../../src/cv-import/import-cv'
import { maxPdfBytes, readPdfText } from '../../src/cv-import/read-pdf'
import { makePdf, type PdfTextItem } from './make-pdf'
import { person } from './synthetic'

const readPdf: ReadPdf = (bytes) => readPdfText(pdfjs, bytes)
const now = new Date('2026-09-28T10:00:00Z')

const cvPage: PdfTextItem[] = [
  { text: person.name, x: 72, y: 740, size: 20, bold: true },
  { text: `${person.email} | ${person.phone}`, x: 72, y: 716 },
  { text: person.linkedin, x: 72, y: 702 },
  { text: 'Summary', x: 72, y: 670, size: 13, bold: true },
  {
    text: 'Backend engineer with eight years of experience building payment systems.',
    x: 72,
    y: 654,
  },
  { text: 'Experience', x: 72, y: 624, size: 13, bold: true },
  { text: 'Staff Engineer, Northwind Payments', x: 72, y: 608 },
  { text: 'Jan 2021 - Present', x: 460, y: 608 },
  {
    text: '- Led the migration of the ledger service to Kubernetes, cutting deploy time by 70%.',
    x: 72,
    y: 594,
  },
  { text: 'Skills', x: 72, y: 564, size: 13, bold: true },
  {
    text: 'Go, Python, PostgreSQL, Kafka, Kubernetes, Terraform',
    x: 72,
    y: 548,
  },
]

describe('readPdfText', () => {
  it('returns positioned runs with their font size', async () => {
    const pdf = await readPdf(makePdf([{ items: cvPage }]))
    expect(pdf.pages).toHaveLength(1)
    const name = pdf.pages[0]?.runs.find((run) => run.text === person.name)
    expect(name).toMatchObject({ x: 72, y: 740, fontSize: 20 })
    expect(pdf.hasImageOnFirstPage).toBe(false)
  })

  it('reports an image on page 1, such as a photo', async () => {
    const pdf = await readPdf(
      makePdf([
        { items: cvPage, image: { x: 480, y: 700, width: 60, height: 60 } },
      ]),
    )
    expect(pdf.hasImageOnFirstPage).toBe(true)
  })

  it('leaves the caller’s bytes intact', async () => {
    const bytes = makePdf([{ items: cvPage }])
    const copy = bytes.slice()
    await readPdf(bytes)
    expect(bytes).toEqual(copy)
  })
})

describe('importPdf', () => {
  it('builds a stored CV with the header stripped', async () => {
    const bytes = makePdf([{ items: cvPage }])
    const result = await importPdf({ name: 'cv.pdf', bytes }, readPdf, now)
    if (!result.ok) throw new Error(result.failure)

    const { cv } = result
    expect(cv.fileName).toBe('cv.pdf')
    expect(cv.importedAt).toBe(now.toISOString())
    expect(cv.confirmedAt).toBeUndefined()
    expect(cv.pdfBase64).toBe(Buffer.from(bytes).toString('base64'))
    expect(cv.corrections.name).toBe(person.name)

    const sent = JSON.stringify(cv.stripped)
    for (const value of [
      person.name,
      person.email,
      person.phone,
      person.linkedin,
    ])
      expect(sent).not.toContain(value)
    expect(cv.stripped.roles[0]?.dates).toEqual({
      start: { year: 2021, month: 1 },
      end: 'present',
    })
    expect(cv.stripped.skills[0]?.text).toContain('Kafka')
  })

  it('reads text written out of reading order', async () => {
    const shuffled = [...cvPage].reverse()
    const result = await importPdf(
      { name: 'cv.pdf', bytes: makePdf([{ items: shuffled }]) },
      readPdf,
      now,
    )
    if (!result.ok) throw new Error(result.failure)
    expect(result.cv.lines.map((line) => line.text).slice(0, 4)).toEqual([
      person.name,
      `${person.email} | ${person.phone}`,
      person.linkedin,
      'Summary',
    ])
  })

  it('refuses a scanned PDF: an image and no text layer', async () => {
    const bytes = makePdf([
      { items: [], image: { x: 0, y: 0, width: 612, height: 792 } },
      { items: [], image: { x: 0, y: 0, width: 612, height: 792 } },
    ])
    expect(await importPdf({ name: 'scan.pdf', bytes }, readPdf)).toEqual({
      ok: false,
      failure: 'scanned',
    })
  })

  it('refuses a file that is not a PDF', async () => {
    const bytes = new TextEncoder().encode('Plain text, not a PDF')
    expect(await importPdf({ name: 'cv.txt', bytes }, readPdf)).toEqual({
      ok: false,
      failure: 'not_pdf',
    })
  })

  it('refuses a PDF over the size limit before reading it', async () => {
    const bytes = new Uint8Array(maxPdfBytes + 1)
    bytes.set(new TextEncoder().encode('%PDF-1.4'))
    const neverRead: ReadPdf = () => Promise.reject(new Error('read'))
    expect(await importPdf({ name: 'big.pdf', bytes }, neverRead)).toEqual({
      ok: false,
      failure: 'too_large',
    })
  })

  it('reports a damaged PDF as unreadable', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\nnot really a pdf')
    expect(await importPdf({ name: 'bad.pdf', bytes }, readPdf)).toEqual({
      ok: false,
      failure: 'unreadable',
    })
  })
})

describe('importPastedText', () => {
  it('parses pasted CV text', () => {
    const text = cvPage.map((item) => item.text).join('\n')
    const result = importPastedText(text, now)
    if (!result.ok) throw new Error(result.failure)
    expect(result.cv.source).toBe('paste')
    expect(result.cv.pdfBase64).toBeUndefined()
    expect(JSON.stringify(result.cv.stripped)).not.toContain(person.email)
  })

  it('refuses too little text', () => {
    expect(importPastedText('Jordan Sample\nEngineer')).toEqual({
      ok: false,
      failure: 'too_little_text',
    })
  })
})
