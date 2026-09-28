// CV import for the setup and settings screens (docs/spec.md §4.1 step 2):
// read a PDF locally, refuse scanned or oversized files, or take pasted text.
// No CV content is logged.

import { bytesToBase64 } from '../core/base64'
import {
  buildLines,
  checkTextLayer,
  countVisible,
  linesFromText,
} from '../core/cv/lines'
import { createStoredCv } from '../core/cv/stored'
import type { PdfText } from '../core/cv/types'
import type { StoredCv } from '../core/settings'
import { maxPdfBytes } from './read-pdf'

export type ImportFailure =
  'not_pdf' | 'too_large' | 'unreadable' | 'scanned' | 'too_little_text'

export type ImportResult =
  { ok: true; cv: StoredCv } | { ok: false; failure: ImportFailure }

export type ReadPdf = (bytes: Uint8Array) => Promise<PdfText>

const minPastedChars = 200

export const importFailureMessages: Record<ImportFailure, string> = {
  not_pdf:
    'That file is not a PDF. Pick your CV as a PDF, or paste the CV text instead.',
  too_large:
    'That PDF is larger than 5 MB. Export a smaller text PDF, or paste the CV text instead.',
  unreadable:
    'The PDF could not be read. Export it again from your editor, or paste the CV text instead.',
  scanned:
    'This looks like a scanned PDF. Export a text PDF from your editor, or paste the CV text instead.',
  too_little_text: 'That is too little text for a CV. Paste the whole CV text.',
}

export async function importPdf(
  file: { name: string; bytes: Uint8Array },
  readPdf: ReadPdf,
  now = new Date(),
): Promise<ImportResult> {
  if (!isPdf(file.bytes)) return { ok: false, failure: 'not_pdf' }
  if (file.bytes.length > maxPdfBytes)
    return { ok: false, failure: 'too_large' }

  let pdf: PdfText
  try {
    pdf = await readPdf(file.bytes)
  } catch {
    return { ok: false, failure: 'unreadable' }
  }
  if (!checkTextLayer(pdf).ok) return { ok: false, failure: 'scanned' }

  return {
    ok: true,
    cv: createStoredCv({
      fileName: file.name,
      source: 'pdf',
      pdfBase64: bytesToBase64(file.bytes),
      lines: buildLines(pdf),
      hasImageOnFirstPage: pdf.hasImageOnFirstPage,
      now,
    }),
  }
}

export function importPastedText(text: string, now = new Date()): ImportResult {
  if (countVisible(text) < minPastedChars)
    return { ok: false, failure: 'too_little_text' }
  return {
    ok: true,
    cv: createStoredCv({
      fileName: 'Pasted text',
      source: 'paste',
      lines: linesFromText(text),
      hasImageOnFirstPage: false,
      now,
    }),
  }
}

function isPdf(bytes: Uint8Array): boolean {
  const signature = '%PDF-'
  const head = String.fromCharCode(...bytes.subarray(0, 1024))
  return head.includes(signature)
}
