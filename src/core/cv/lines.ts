// Rebuilds reading-order lines from positioned PDF text (docs/spec.md §4.3
// step 1): rows by y then x, with a two-column split when a page has a clear
// vertical gutter, as sidebar CV templates do.

import type { CvLine, PageText, PdfText, TextRun } from './types'

// Scanned-PDF refusal (docs/spec.md §4.3 step 1).
const minTotalChars = 200
const minPageChars = 20

// A gap wider than this many font sizes splits a row into segments: wide
// enough to skip word spacing, narrow enough to catch a column gutter or
// right-aligned dates.
const segmentGapEms = 2
// A gap wider than this many font sizes between runs gets a space.
const wordGapEms = 0.15

export type TextLayerCheck =
  { ok: true } | { ok: false; reason: 'too_little_text' | 'most_pages_empty' }

export function checkTextLayer(pdf: PdfText): TextLayerCheck {
  const pageChars = pdf.pages.map((page) =>
    page.runs.reduce((sum, run) => sum + countVisible(run.text), 0),
  )
  const totalChars = pageChars.reduce((sum, chars) => sum + chars, 0)
  if (totalChars < minTotalChars)
    return { ok: false, reason: 'too_little_text' }

  const emptyPages = pageChars.filter((chars) => chars < minPageChars).length
  if (emptyPages > pdf.pages.length / 2)
    return { ok: false, reason: 'most_pages_empty' }

  return { ok: true }
}

export function buildLines(pdf: PdfText): CvLine[] {
  const texts = pdf.pages.flatMap((page, pageIndex) =>
    orderPage(page).map((segment) => ({
      page: pageIndex + 1,
      text: joinRuns(segment.runs),
      fontSize: segment.fontSize,
    })),
  )
  return texts
    .filter((line) => line.text !== '')
    .map((line, index) => ({ index, ...line }))
}

/** The paste-text fallback: one line per non-empty text line, no font data. */
export function linesFromText(text: string): CvLine[] {
  return text
    .split(/\r?\n/)
    .map(normalizeSpaces)
    .filter((line) => line !== '')
    .map((line, index) => ({ index, page: 1, text: line, fontSize: 0 }))
}

export function countVisible(text: string): number {
  return text.replace(/\s/g, '').length
}

interface Segment {
  runs: TextRun[]
  x0: number
  x1: number
  y: number
  fontSize: number
}

type Row = Segment[]

function orderPage(page: PageText): Segment[] {
  const rows = groupRows(page.runs.filter((run) => run.text.trim() !== ''))
  const gutter = findGutter(rows)
  if (gutter === undefined) return rows.map(mergeRow)

  // Rows with a segment across the gutter are full width (a name banner, a
  // footer) and break the page into bands; inside a band the left column is
  // read before the right one.
  const ordered: Segment[] = []
  let band: Row[] = []
  const flushBand = () => {
    const segments = band.flat()
    ordered.push(
      ...segments.filter((segment) => segment.x1 <= gutter),
      ...segments.filter((segment) => segment.x0 >= gutter),
    )
    band = []
  }
  for (const row of rows) {
    if (row.some((segment) => crosses(segment, gutter))) {
      flushBand()
      ordered.push(mergeRow(row))
    } else band.push(row)
  }
  flushBand()
  return ordered
}

function groupRows(runs: TextRun[]): Row[] {
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: TextRun[][] = []
  for (const run of sorted) {
    const row = rows.at(-1)
    const first = row?.[0]
    const tolerance = Math.max(
      1,
      Math.min(run.fontSize, first?.fontSize ?? 0) / 2,
    )
    if (
      row !== undefined &&
      first !== undefined &&
      Math.abs(first.y - run.y) <= tolerance
    )
      row.push(run)
    else rows.push([run])
  }
  return rows.map((row) => splitSegments(row.sort((a, b) => a.x - b.x)))
}

function splitSegments(runs: TextRun[]): Row {
  const segments: Row = []
  for (const run of runs) {
    const segment = segments.at(-1)
    const gap = segment === undefined ? 0 : run.x - segment.x1
    const em = Math.max(run.fontSize, 1)
    if (segment !== undefined && gap <= segmentGapEms * em) {
      segment.runs.push(run)
      segment.x1 = Math.max(segment.x1, run.x + run.width)
      segment.fontSize = Math.max(segment.fontSize, run.fontSize)
    } else
      segments.push({
        runs: [run],
        x0: run.x,
        x1: run.x + run.width,
        y: run.y,
        fontSize: run.fontSize,
      })
  }
  return segments
}

// A gutter is an x position no segment crosses (or only a few full-width
// ones), with enough rows that hold text on one side only. Right-aligned
// dates never qualify: they always share a row with text on the left.
function findGutter(rows: Row[]): number | undefined {
  const segments = rows.flat()
  const candidates = [...new Set(segments.map((segment) => segment.x0))]
  let best: { gutter: number; score: number } | undefined

  for (const gutter of candidates) {
    const crossing = rows.filter((row) => row.some((s) => crosses(s, gutter)))
    const clean = rows.filter((row) => !crossing.includes(row))
    const leftOnly = clean.filter((row) => row.every((s) => s.x1 <= gutter))
    const rightOnly = clean.filter((row) => row.every((s) => s.x0 >= gutter))
    const leftRows = clean.length - rightOnly.length
    const rightRows = clean.length - leftOnly.length

    const isColumnLayout =
      crossing.length <= rows.length * 0.25 &&
      leftRows >= 3 &&
      rightRows >= 3 &&
      rightOnly.length >= rightRows * 0.3 &&
      leftOnly.length >= leftRows * 0.3
    if (!isColumnLayout) continue

    const score = Math.min(leftRows, rightRows) - crossing.length
    if (best === undefined || score > best.score) best = { gutter, score }
  }
  return best?.gutter
}

function crosses(segment: Segment, gutter: number): boolean {
  return segment.x0 < gutter && segment.x1 > gutter
}

function mergeRow(row: Row): Segment {
  const [first, ...rest] = row
  if (first === undefined) throw new Error('A row always has a segment')
  return rest.reduce<Segment>(
    (merged, segment) => ({
      runs: [...merged.runs, ...segment.runs],
      x0: merged.x0,
      x1: segment.x1,
      y: merged.y,
      fontSize: Math.max(merged.fontSize, segment.fontSize),
    }),
    first,
  )
}

function joinRuns(runs: TextRun[]): string {
  let text = ''
  let previous: TextRun | undefined
  for (const run of runs) {
    const gap =
      previous === undefined ? 0 : run.x - (previous.x + previous.width)
    const needsSpace =
      previous !== undefined &&
      gap > wordGapEms * Math.max(run.fontSize, 1) &&
      !/\s$/.test(text) &&
      !/^\s/.test(run.text)
    text += (needsSpace ? ' ' : '') + run.text
    previous = run
  }
  return normalizeSpaces(text)
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
