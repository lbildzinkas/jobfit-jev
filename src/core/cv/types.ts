// CV shapes for import, parsing, and stripping (docs/spec.md §4.3). Every
// value is plain data so it can be stored in chrome.storage.local unchanged.

/** One positioned piece of text from a PDF page, in PDF coordinates. */
export interface TextRun {
  text: string
  x: number
  /** Baseline, measured from the bottom of the page. */
  y: number
  width: number
  fontSize: number
}

export interface PageText {
  runs: TextRun[]
}

/** What the PDF reader hands to the core library. */
export interface PdfText {
  pages: PageText[]
  /** Whether page 1 draws an image, which on a CV is usually a photo. */
  hasImageOnFirstPage: boolean
}

/** One line of the CV in reading order; `index` is its stable position. */
export interface CvLine {
  index: number
  page: number
  text: string
  /** 0 when unknown, as for pasted text. */
  fontSize: number
}

export type SectionKind =
  'summary' | 'experience' | 'education' | 'skills' | 'other'

export type PiiKind =
  'email' | 'phone' | 'link' | 'address' | 'name' | 'private'

/** A span of a line found as personal detail, by character offsets. */
export interface PiiSpan {
  kind: PiiKind
  start: number
  end: number
  text: string
}

export type ProtectedCategory =
  | 'birth_or_age'
  | 'gender'
  | 'family_status'
  | 'nationality'
  | 'work_authorization'
  | 'religion'
  | 'ethnicity'
  | 'health_or_disability'
  | 'photo'
  | 'marked_private'

/** The owner's corrections, stored with the CV and re-applied every parse. */
export interface CvCorrections {
  /** Index of the first body line; overrides the detected header boundary. */
  headerEnd?: number
  /** The owner-confirmed full name, stripped wherever it appears. */
  name: string
  /** Owner-confirmed address strings, stripped wherever they appear. */
  addresses: string[]
  /** Extra text the owner marked private, stripped wherever it appears. */
  privateStrings: string[]
  /** Detected span texts the owner un-marked as false positives. */
  releasedStrings: string[]
  /** Body lines the owner marked private (withheld whole). */
  privateLines: number[]
  /** Lines withheld as protected attributes that the owner un-marked. */
  releasedLines: number[]
  /** Lines the owner made section headings, or un-made. */
  addedHeadings: number[]
  removedHeadings: number[]
  /** Section kind chosen by the owner, keyed by the section's start line. */
  sectionKinds: Record<number, SectionKind>
}

export interface DatePoint {
  year: number
  /** 1–12, absent when only the year is given. */
  month?: number
}

export interface DateRange {
  start: DatePoint
  end: DatePoint | 'present'
}

/** A body line after stripping, with its stable ID (`L000`, …). */
export interface IdLine {
  id: string
  text: string
  /** Index of the CvLine it came from. */
  source: number
}

export interface StrippedRole {
  header: IdLine[]
  lines: IdLine[]
  dates?: DateRange
  datesUnparsed: boolean
}

/** The only CV shape that may later be sent to Jev (docs/spec.md §7.3). */
export interface StrippedCv {
  summary: IdLine[]
  roles: StrippedRole[]
  education: IdLine[]
  skills: IdLine[]
  other: IdLine[]
}

export interface CvSection {
  kind: SectionKind
  /** Heading text as written; empty when the section has no heading line. */
  heading: string
  /** Line index where the section starts; keys the owner's kind override. */
  start: number
  /** Line index of the heading, absent for body text before any heading. */
  headingLine?: number
  /** Line indexes of the section's content, heading excluded. */
  lines: number[]
  source: 'dictionary' | 'layout' | 'owner' | 'no_heading'
}

export type LineStatus =
  | { kind: 'header'; pii: PiiSpan[] }
  | {
      kind: 'heading'
      section: number
      pii: PiiSpan[]
      /** Heading text after removing any PII spans. */
      kept: string
    }
  | {
      kind: 'body'
      section: number
      pii: PiiSpan[]
      /** Text left after removing the PII spans; empty drops the line. */
      kept: string
    }
  | {
      kind: 'withheld'
      section: number
      category: ProtectedCategory
      /** The words that matched, so the owner can see why. */
      match: string
    }

export interface ParsedCv {
  lines: CvLine[]
  /** Index of the first body line; lines before it are the header. */
  headerEnd: number
  /** Whether no dictionary heading was found, so everything is header. */
  noHeadingFound: boolean
  sections: CvSection[]
  statuses: LineStatus[]
  nameCandidate: string
  addressCandidates: string[]
  stripped: StrippedCv
}
