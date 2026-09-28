// The PII sweep (docs/spec.md §4.3 step 5): emails, phone numbers, links and
// handles, street addresses, and every owner-confirmed name, address, or
// private string, found anywhere in the CV. Deterministic patterns only;
// when in doubt a span is stripped, and the owner can release it.

import { isDateLine } from './dates'
import type { PiiKind, PiiSpan } from './types'

export interface SweepTerms {
  /** Owner-confirmed strings stripped wherever they appear. */
  names: string[]
  addresses: string[]
  privateStrings: string[]
  /** Detected span texts the owner un-marked as false positives. */
  releasedStrings: string[]
}

const tlds =
  'com|net|org|io|dev|me|app|co|ai|xyz|page|site|tech|info|biz|eu|uk|us|ca|au|de|fr|es|it|nl|pt|br|ar|mx|ch|at|be|se|no|dk|fi|pl|ie|in|jp'

const patterns: { kind: PiiKind; pattern: RegExp }[] = [
  {
    kind: 'email',
    pattern: /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.\p{L}{2,}/giu,
  },
  { kind: 'link', pattern: /\b(?:https?:\/\/|www\.)[^\s|,;·•]+/giu },
  {
    // Bare domains and profile paths: jane.dev, github.com/jane. Lower case
    // only, so "ASP.NET" is left alone.
    kind: 'link',
    pattern: new RegExp(
      `(?<![\\p{L}\\d@.-])[a-z\\d][a-z\\d-]*(?:\\.[a-z\\d-]+)*\\.(?:${tlds})\\b(?:/[^\\s|,;·•]*)?`,
      'gu',
    ),
  },
  { kind: 'link', pattern: /(?<![\p{L}\d.])@[A-Za-z\d_]{2,}\b/gu },
  {
    kind: 'address',
    pattern:
      /\b\d{1,5}[a-z]?\s+(?:[\p{Lu}][\p{L}'-]*\.?\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Square|Sq|Parkway|Pkwy|Highway|Hwy)\b\.?(?:,?\s*(?:Apt|Apartment|Suite|Unit|Flat)\.?\s*[\w-]+)?/gu,
  },
  {
    kind: 'address',
    pattern:
      /\b(?:Rua|Avenida|Av\.|Travessa|Alameda|Praça|Estrada|Rodovia|Calle|Carrer|Carretera|Rue|Chemin|Viale|Piazza)\s+[^,\n|·•]{2,40}?,?\s*(?:n[º°o.]?\s*)?\d{1,5}[a-zA-Z]?\b/gu,
  },
  {
    kind: 'address',
    pattern:
      /\b[\p{Lu}][\p{L}-]*(?:straße|strasse|str\.|weg|platz|allee|gasse)\s+\d{1,4}[a-z]?\b/gu,
  },
  // Postal codes with a distinctive shape: Brazilian CEP, US state + ZIP.
  // Shorter shapes (UK, bare ZIP) collide with product names and figures and
  // are left to the header and the owner-confirmed address.
  { kind: 'address', pattern: /\b\d{5}-\d{3}\b/gu },
  { kind: 'address', pattern: /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/gu },
  // Last, so a postal code shaped like a phone number is named an address.
  {
    kind: 'phone',
    pattern:
      /(?<![\p{L}\d])(?:\+\s?)?(?:\(\d{1,4}\)[\s.-]?)?\d[\d\s.()-]{5,}\d(?![\p{L}\d])/gu,
  },
]

const minPhoneDigits = 8
const maxPhoneDigits = 15

export function findPii(text: string, terms: SweepTerms): PiiSpan[] {
  const released = new Set(terms.releasedStrings.map(foldCase))
  const spans: PiiSpan[] = []

  const ownerTerms: { kind: PiiKind; values: string[] }[] = [
    { kind: 'name', values: terms.names },
    { kind: 'address', values: terms.addresses },
    { kind: 'private', values: terms.privateStrings },
  ]
  for (const { kind, values } of ownerTerms)
    for (const value of values) spans.push(...findLiteral(text, value, kind))

  for (const { kind, pattern } of patterns)
    for (const match of text.matchAll(pattern)) {
      const span = trimSpan(kind, match.index, match[0])
      if (span === undefined) continue
      if (kind === 'phone' && !isPhoneLike(span.text)) continue
      if (released.has(foldCase(span.text))) continue
      spans.push(span)
    }

  return mergeSpans(text, spans)
}

/** The line with every span removed and its leftover separators tidied. */
export function removeSpans(text: string, spans: PiiSpan[]): string {
  if (spans.length === 0) return text
  let kept = ''
  let cursor = 0
  for (const span of spans) {
    kept += `${text.slice(cursor, span.start)} `
    cursor = span.end
  }
  kept += text.slice(cursor)
  return tidy(kept)
}

function findLiteral(text: string, value: string, kind: PiiKind): PiiSpan[] {
  const needle = value.trim()
  if (needle.length < 2) return []
  const pattern = new RegExp(
    `(?<![\\p{L}\\d])${escapeRegExp(needle).replace(/\s+/g, '\\s+')}(?![\\p{L}\\d])`,
    'giu',
  )
  return [...text.matchAll(pattern)].map((match) => ({
    kind,
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  }))
}

// Trailing punctuation belongs to the sentence, not the link or address.
function trimSpan(
  kind: PiiKind,
  start: number,
  raw: string,
): PiiSpan | undefined {
  const text = raw.replace(/[.,;:)\]]+$/u, '').trimEnd()
  if (text === '') return undefined
  return { kind, start, end: start + text.length, text }
}

function isPhoneLike(text: string): boolean {
  const digits = text.replace(/\D/g, '')
  if (digits.length < minPhoneDigits || digits.length > maxPhoneDigits)
    return false
  // "2019 - 2021" and "01.2019 - 03.2021" are dates, not a phone number.
  if (isDateLine(text)) return false
  const groups = text.split(/[^\d]+/).filter((group) => group !== '')
  return !groups.every((group) => /^(?:19|20)\d{2}$/.test(group))
}

function mergeSpans(text: string, spans: PiiSpan[]): PiiSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: PiiSpan[] = []
  for (const span of sorted) {
    const last = merged.at(-1)
    if (last !== undefined && span.start < last.end) {
      last.end = Math.max(last.end, span.end)
      last.text = text.slice(last.start, last.end)
    } else merged.push({ ...span })
  }
  return merged
}

// Separators left dangling once a span is gone: "Berlin |  | " → "Berlin".
// A leading bullet or dash stays: it marks a list item, not a separator.
function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*[|·•]\s*){2,}/gu, ' | ')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/^[\s|·,;:/]+/u, '')
    .replace(/[\s|·•,;:/–—-]+$/u, '')
    .trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function foldCase(text: string): string {
  return text.trim().toLowerCase()
}
