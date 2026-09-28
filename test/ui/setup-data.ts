// Stored data for the UI tests, built from the synthetic CV.

import { confirmStoredCv, createStoredCv } from '../../src/core/cv/stored'
import { defaultSettings, type StoredCv } from '../../src/core/settings'
import { classicCv } from '../cv/synthetic'

export const now = new Date('2026-09-28T10:00:00Z')

// Built at run time so no committed literal looks like a real credential.
export const fakeKey = ['sk', 'or', 'v1', 'abcd'.repeat(6)].join('-')

export function importedCv(): StoredCv {
  return createStoredCv({
    fileName: 'synthetic-cv.pdf',
    source: 'pdf',
    pdfBase64: 'JVBERi0xLjQ=',
    lines: classicCv,
    hasImageOnFirstPage: true,
    now,
  })
}

export function completeSetup(): Record<string, unknown> {
  const cv = importedCv()
  return {
    settings: { ...defaultSettings, eligibilityStepDone: true },
    apiKeys: { openrouter: fakeKey },
    cv: confirmStoredCv(cv, cv.corrections, now),
  }
}
