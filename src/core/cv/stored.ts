// Building and updating the stored canonical CV (docs/spec.md §3.4, §4.1).

import type { StoredCv } from '../settings'
import { parseCv, parseNewCv } from './parse'
import type { CvCorrections, CvLine, ParsedCv } from './types'

export interface NewCvInput {
  fileName: string
  source: StoredCv['source']
  pdfBase64?: string
  lines: CvLine[]
  hasImageOnFirstPage: boolean
  now: Date
}

/** A freshly imported CV, not yet confirmed by the owner. */
export function createStoredCv(input: NewCvInput): StoredCv {
  const { parsed, corrections } = parseNewCv(input.lines)
  return {
    fileName: input.fileName,
    source: input.source,
    ...(input.pdfBase64 === undefined ? {} : { pdfBase64: input.pdfBase64 }),
    importedAt: input.now.toISOString(),
    lines: input.lines,
    hasImageOnFirstPage: input.hasImageOnFirstPage,
    corrections,
    stripped: parsed.stripped,
  }
}

export function parseStoredCv(
  cv: StoredCv,
  corrections = cv.corrections,
): ParsedCv {
  return parseCv(cv.lines, corrections)
}

/** The owner confirmed the parsed CV with these corrections. */
export function confirmStoredCv(
  cv: StoredCv,
  corrections: CvCorrections,
  now: Date,
): StoredCv {
  return {
    ...cv,
    corrections,
    stripped: parseCv(cv.lines, corrections).stripped,
    confirmedAt: now.toISOString(),
  }
}
