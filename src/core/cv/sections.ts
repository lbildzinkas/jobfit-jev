// Section headings (docs/spec.md §4.3 step 2): a heading dictionary plus
// layout cues. Only a dictionary heading ends the header (step 4); a layout
// heading only splits the body.

import { isDateLine, isRoleDateLine } from './dates'
import type { CvLine, SectionKind } from './types'

const dictionary: Record<SectionKind, string[]> = {
  summary: [
    'summary',
    'professional summary',
    'career summary',
    'executive summary',
    'profile',
    'professional profile',
    'personal profile',
    'about',
    'about me',
    'objective',
    'career objective',
    'personal statement',
    'overview',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'relevant experience',
    'employment',
    'employment history',
    'work history',
    'career history',
    'professional background',
    'experience and projects',
  ],
  education: [
    'education',
    'education and training',
    'academic background',
    'academic qualifications',
    'qualifications',
    'education and certifications',
  ],
  skills: [
    'skills',
    'technical skills',
    'core skills',
    'key skills',
    'skills and tools',
    'skills and technologies',
    'skills and expertise',
    'competencies',
    'core competencies',
    'technologies',
    'tech stack',
    'tools',
    'expertise',
    'areas of expertise',
  ],
  other: [
    'projects',
    'personal projects',
    'side projects',
    'selected projects',
    'key projects',
    'open source',
    'certifications',
    'certificates',
    'licenses and certifications',
    'courses',
    'training',
    'languages',
    'publications',
    'talks',
    'speaking',
    'patents',
    'awards',
    'honors',
    'honours',
    'honors and awards',
    'achievements',
    'volunteering',
    'volunteer experience',
    'leadership',
    'activities',
    'memberships',
    'affiliations',
    'interests',
    'hobbies',
    'references',
    'additional information',
  ],
}

const headingKinds = new Map<string, SectionKind>(
  Object.entries(dictionary).flatMap(([kind, names]) =>
    names.map((name) => [name, kind as SectionKind] as const),
  ),
)

const maxLayoutHeadingChars = 40
const maxLayoutHeadingWords = 5
const largerFontRatio = 1.15

// Letter-spaced headings ("W O R K  E X P E R I E N C E") lose their word
// breaks once spaces are collapsed, so they match on the letters alone.
const compactHeadingKinds = new Map<string, SectionKind>(
  [...headingKinds].map(([name, kind]) => [name.replace(/ /g, ''), kind]),
)

export function dictionaryKind(text: string): SectionKind | undefined {
  const trimmed = text.trim().replace(/[:：]$/, '')
  if (/^(?:\p{L}\s+)+\p{L}$/u.test(trimmed))
    return compactHeadingKinds.get(normalizeHeading(trimmed).replace(/ /g, ''))
  return headingKinds.get(normalizeHeading(text))
}

export interface HeadingStyle {
  /** Body text size; 0 when unknown. */
  bodySize: number
  /** Smallest dictionary heading size; 0 when unknown or none found. */
  headingSize: number
}

/**
 * A generic heading by layout: a short line, in a larger font or in capitals
 * (and no smaller than the dictionary headings), followed by content that is
 * not itself such a heading. A line followed by a date line is a role title,
 * not a heading.
 */
export function isLayoutHeading(
  lines: CvLine[],
  index: number,
  style: HeadingStyle,
): boolean {
  const line = lines[index]
  const next = lines[index + 1]
  if (line === undefined || next === undefined) return false
  if (!looksLikeShortTitle(line.text) || !isEmphasized(line, style))
    return false
  if (looksLikeShortTitle(next.text) && isEmphasized(next, style)) return false
  const nearby = lines.slice(index + 1, index + 3)
  return !nearby.some((candidate) => isRoleDateLine(candidate.text))
}

/** The most common font size by characters: the body text size. */
export function bodyFontSize(lines: CvLine[]): number {
  const weights = new Map<number, number>()
  for (const line of lines) {
    const size = Math.round(line.fontSize * 2) / 2
    weights.set(size, (weights.get(size) ?? 0) + line.text.length)
  }
  let best = 0
  let bestWeight = -1
  for (const [size, weight] of weights)
    if (weight > bestWeight) [best, bestWeight] = [size, weight]
  return best
}

function looksLikeShortTitle(text: string): boolean {
  const words = text.split(' ')
  return (
    text.length <= maxLayoutHeadingChars &&
    words.length <= maxLayoutHeadingWords &&
    /\p{L}/u.test(text) &&
    !/[.,;!?]$/.test(text) &&
    !/^[•▪◦·*–-]/.test(text) &&
    !/\d/.test(text) &&
    !isDateLine(text)
  )
}

function isEmphasized(line: CvLine, style: HeadingStyle): boolean {
  const hasSize = line.fontSize > 0
  if (
    hasSize &&
    style.headingSize > 0 &&
    line.fontSize < style.headingSize - 0.25
  )
    return false
  const isLarger =
    hasSize &&
    style.bodySize > 0 &&
    line.fontSize >= style.bodySize * largerFontRatio
  const letters = line.text.replace(/[^\p{L}]/gu, '')
  const isCapitals =
    letters.length >= 3 && letters === letters.toLocaleUpperCase()
  return isLarger || isCapitals
}

function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[:：]\s*$/, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[^\p{L}&\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
