// CV parsing and header stripping (docs/spec.md §4.3 steps 2–7): sections,
// roles, the header boundary, the PII sweep over the whole CV,
// protected-attribute withholding, and line IDs. Deterministic: the same
// lines and corrections always give the same result.

import { isDateLine, parseDateRange } from './dates'
import { findPii, removeSpans, type SweepTerms } from './pii'
import { findProtected } from './protected'
import {
  bodyFontSize,
  dictionaryKind,
  isLayoutHeading,
  type HeadingStyle,
} from './sections'
import type {
  CvCorrections,
  CvLine,
  CvSection,
  IdLine,
  LineStatus,
  ParsedCv,
  StrippedCv,
  StrippedRole,
} from './types'

export const emptyCorrections: CvCorrections = {
  name: '',
  addresses: [],
  privateStrings: [],
  releasedStrings: [],
  privateLines: [],
  releasedLines: [],
  addedHeadings: [],
  removedHeadings: [],
  sectionKinds: {},
}

const maxRoleHeaderChars = 90
const maxRoleHeaderLinesBefore = 2

/**
 * Parses freshly imported lines and pre-fills the corrections with the
 * detected name and address, for the owner to confirm.
 */
export function parseNewCv(lines: CvLine[]): {
  parsed: ParsedCv
  corrections: CvCorrections
} {
  const first = parseCv(lines, emptyCorrections)
  const corrections: CvCorrections = {
    ...emptyCorrections,
    name: first.nameCandidate,
    addresses: first.addressCandidates,
  }
  return { parsed: parseCv(lines, corrections), corrections }
}

export function parseCv(lines: CvLine[], corrections: CvCorrections): ParsedCv {
  const detectedHeaderEnd = lines.findIndex(
    (line) => dictionaryKind(line.text) !== undefined,
  )
  const noHeadingFound = detectedHeaderEnd === -1
  const headerEnd = clamp(
    corrections.headerEnd ??
      (noHeadingFound ? lines.length : detectedHeaderEnd),
    0,
    lines.length,
  )

  const sections = findSections(lines, headerEnd, corrections)
  const terms: SweepTerms = {
    names: [corrections.name],
    addresses: corrections.addresses,
    privateStrings: corrections.privateStrings,
    releasedStrings: corrections.releasedStrings,
  }
  const statuses = lineStatuses(lines, headerEnd, sections, corrections, terms)

  const header = lines.slice(0, headerEnd)
  return {
    lines,
    headerEnd,
    noHeadingFound,
    sections,
    statuses,
    nameCandidate: findNameCandidate(header),
    addressCandidates: findAddressCandidates(header, terms),
    stripped: buildStripped(sections, statuses),
  }
}

function findSections(
  lines: CvLine[],
  headerEnd: number,
  corrections: CvCorrections,
): CvSection[] {
  const body = lines.slice(headerEnd)
  const dictionarySizes = body
    .filter(
      (line) => dictionaryKind(line.text) !== undefined && line.fontSize > 0,
    )
    .map((line) => line.fontSize)
  const style: HeadingStyle = {
    bodySize: bodyFontSize(body),
    headingSize:
      dictionarySizes.length === 0 ? 0 : Math.min(...dictionarySizes),
  }
  const added = new Set(corrections.addedHeadings)
  const removed = new Set(corrections.removedHeadings)

  const sections: CvSection[] = []
  for (let index = headerEnd; index < lines.length; index++) {
    const line = lines[index]
    if (line === undefined) continue
    const source = headingSource(lines, index, style, added)
    const isHeading = source !== undefined && !removed.has(index)

    if (isHeading) {
      sections.push({
        kind:
          corrections.sectionKinds[index] ??
          dictionaryKind(line.text) ??
          'other',
        heading: line.text,
        start: index,
        headingLine: index,
        lines: [],
        source,
      })
      continue
    }

    let current = sections.at(-1)
    if (current === undefined) {
      // Body text before any heading, when the owner moved the boundary up.
      current = {
        kind: corrections.sectionKinds[index] ?? 'summary',
        heading: '',
        start: index,
        lines: [],
        source: 'no_heading',
      }
      sections.push(current)
    }
    current.lines.push(index)
  }
  return sections
}

function headingSource(
  lines: CvLine[],
  index: number,
  style: HeadingStyle,
  added: Set<number>,
): CvSection['source'] | undefined {
  const line = lines[index]
  if (line === undefined) return undefined
  if (added.has(index)) return 'owner'
  if (dictionaryKind(line.text) !== undefined) return 'dictionary'
  if (isLayoutHeading(lines, index, style)) return 'layout'
  return undefined
}

function lineStatuses(
  lines: CvLine[],
  headerEnd: number,
  sections: CvSection[],
  corrections: CvCorrections,
  terms: SweepTerms,
): LineStatus[] {
  const sectionOf = new Map<number, number>()
  sections.forEach((section, sectionIndex) => {
    if (section.headingLine !== undefined)
      sectionOf.set(section.headingLine, sectionIndex)
    for (const index of section.lines) sectionOf.set(index, sectionIndex)
  })
  const headingLines = new Set(sections.map((section) => section.headingLine))
  const privateLines = new Set(corrections.privateLines)
  const releasedLines = new Set(corrections.releasedLines)

  return lines.map((line, index): LineStatus => {
    const pii = findPii(line.text, terms)
    if (index < headerEnd) return { kind: 'header', pii }

    const section = sectionOf.get(index) ?? 0
    if (privateLines.has(index))
      return {
        kind: 'withheld',
        section,
        category: 'marked_private',
        match: '',
      }
    // Checked before headings: "NATIONALITY: EXAMPLEAN" can look like one.
    const protectedMatch = releasedLines.has(index)
      ? undefined
      : findProtected(line.text)
    if (protectedMatch !== undefined)
      return { kind: 'withheld', section, ...protectedMatch }
    if (headingLines.has(index))
      return {
        kind: 'heading',
        section,
        pii,
        kept: removeSpans(line.text, pii),
      }

    return { kind: 'body', section, pii, kept: removeSpans(line.text, pii) }
  })
}

function buildStripped(
  sections: CvSection[],
  statuses: LineStatus[],
): StrippedCv {
  const stripped: StrippedCv = {
    summary: [],
    roles: [],
    education: [],
    skills: [],
    other: [],
  }
  const idLines: IdLine[] = []
  const keep = (source: number): IdLine | undefined => {
    const status = statuses[source]
    if (status?.kind !== 'body' || status.kept === '') return undefined
    const idLine = { id: '', text: status.kept, source }
    idLines.push(idLine)
    return idLine
  }
  const keepAll = (indexes: number[]) =>
    indexes.map(keep).filter((line) => line !== undefined)

  for (const section of sections) {
    // An "other" section keeps its heading as context ("Languages").
    const headingStatus =
      section.headingLine === undefined
        ? undefined
        : statuses[section.headingLine]
    const heading =
      section.kind === 'other' &&
      section.headingLine !== undefined &&
      headingStatus?.kind === 'heading' &&
      headingStatus.kept !== ''
        ? [{ id: '', text: headingStatus.kept, source: section.headingLine }]
        : []
    idLines.push(...heading)

    if (section.kind === 'experience') {
      const { preamble, roles } = splitRoles(keepAll(section.lines))
      stripped.other.push(...heading, ...preamble)
      stripped.roles.push(...roles)
    } else stripped[section.kind].push(...heading, ...keepAll(section.lines))
  }

  // IDs follow reading order across the whole CV.
  idLines
    .sort((a, b) => a.source - b.source)
    .forEach((line, index) => (line.id = `L${String(index).padStart(3, '0')}`))
  return stripped
}

// Roles (docs/spec.md §4.3 step 3): a date-range line plus the short title
// and company lines next to it start a role.
function splitRoles(lines: IdLine[]): {
  preamble: IdLine[]
  roles: StrippedRole[]
} {
  const dateIndexes = lines.flatMap((line, index) =>
    isDateLine(line.text) ? [index] : [],
  )
  if (dateIndexes.length === 0) {
    const [first, ...rest] = lines
    return first === undefined
      ? { preamble: [], roles: [] }
      : {
          preamble: [],
          roles: [{ header: [first], lines: rest, datesUnparsed: true }],
        }
  }

  const spans: { from: number; to: number; dateLine: IdLine }[] = []
  let claimed = -1
  for (const dateIndex of dateIndexes) {
    const dateLine = lines[dateIndex]
    if (dateLine === undefined || dateIndex <= claimed) continue
    let from = dateIndex
    while (
      from - 1 > claimed &&
      dateIndex - (from - 1) <= maxRoleHeaderLinesBefore &&
      isRoleHeaderLike(lines[from - 1])
    )
      from--
    let to = dateIndex
    const next = lines[dateIndex + 1]
    if (
      from === dateIndex &&
      isDateOnly(dateLine.text) &&
      isRoleHeaderLike(next)
    )
      to++
    spans.push({ from, to, dateLine })
    claimed = to
  }

  const roles = spans.map((span, index): StrippedRole => {
    const end = spans[index + 1]?.from ?? lines.length
    const dates = parseDateRange(span.dateLine.text)
    return {
      header: lines.slice(span.from, span.to + 1),
      lines: lines.slice(span.to + 1, end),
      ...(dates === undefined ? {} : { dates }),
      datesUnparsed: dates === undefined,
    }
  })
  return { preamble: lines.slice(0, spans[0]?.from ?? 0), roles }
}

function isRoleHeaderLike(line: IdLine | undefined): boolean {
  if (line === undefined) return false
  return (
    line.text.length <= maxRoleHeaderChars &&
    !/^[•▪◦·*–-]/.test(line.text) &&
    !line.text.endsWith('.') &&
    !isDateLine(line.text)
  )
}

function isDateOnly(text: string): boolean {
  const letters = text
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/[^\p{L}]/gu, '')
  return letters.length <= 12
}

// The name: the largest header line that reads as two to five name words.
function findNameCandidate(header: CvLine[]): string {
  const namePattern = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{L}[\p{L}'’.-]*){1,4}$/u
  const candidates = header
    .flatMap((line) =>
      line.text
        .split(/\s*[|·•,]\s*/)
        .map((part) => ({ text: part.trim(), fontSize: line.fontSize })),
    )
    .filter(
      (part) =>
        namePattern.test(part.text) && dictionaryKind(part.text) === undefined,
    )
  const largest = Math.max(0, ...candidates.map((part) => part.fontSize))
  return candidates.find((part) => part.fontSize === largest)?.text ?? ''
}

function findAddressCandidates(header: CvLine[], terms: SweepTerms): string[] {
  const found = header.flatMap((line) =>
    findPii(line.text, {
      ...terms,
      addresses: [],
      names: [],
      privateStrings: [],
    })
      .filter((span) => span.kind === 'address')
      .map((span) => span.text),
  )
  return [...new Set(found)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
