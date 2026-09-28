// Role date ranges (docs/spec.md §4.3 step 3): `Mon YYYY – Mon YYYY | Present`,
// `MM/YYYY`, `YYYY–YYYY`, with English, Portuguese, Spanish, German, and
// French month names. Dates are parsed in code; Jev never reads them.

import type { DatePoint, DateRange } from './types'

const monthNames: Record<string, number> = {}
const monthLists = [
  // English
  'jan feb mar apr may jun jul aug sep oct nov dec',
  'january february march april may june july august september october november december',
  // Portuguese
  'jan fev mar abr mai jun jul ago set out nov dez',
  'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro',
  // Spanish
  'ene feb mar abr may jun jul ago sep oct nov dic',
  'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre',
  // German
  'jan feb mär apr mai jun jul aug sep okt nov dez',
  'januar februar märz april mai juni juli august september oktober november dezember',
  // French
  'janv févr mars avr mai juin juil août sept oct nov déc',
  'janvier février mars avril mai juin juillet août septembre octobre novembre décembre',
]
for (const list of monthLists)
  list.split(' ').forEach((name, index) => (monthNames[name] = index + 1))
Object.assign(monthNames, { sept: 9, mrz: 3, marco: 3, fevr: 2, fev: 2 })

const presentWords = [
  'present',
  'current',
  'currently',
  'now',
  'today',
  'ongoing',
  'atual',
  'atualmente',
  'presente',
  'actualidad',
  'actual',
  'heute',
  'aktuell',
  'jetzt',
  "aujourd'hui",
  'maintenant',
]

const month = `(?:${Object.keys(monthNames)
  .sort((a, b) => b.length - a.length)
  .join('|')})\\.?`
const year = '(?:19|20)\\d{2}'
const point = `(?:${month}\\s+${year}|(?:0?[1-9]|1[0-2])[/.]${year}|${year})`
const present = `(?:${presentWords.join('|')})`
const separator = '\\s*(?:[-–—]|to|until|till|até|a|hasta|bis|au)\\s*'

const rangePattern = new RegExp(
  `(?<![\\p{L}\\d])(${point})${separator}(${point}|${present})(?![\\p{L}\\d])`,
  'iu',
)
// "Since 2019" and its translations: an open range.
const sincePattern = new RegExp(
  `(?<![\\p{L}])(?:since|desde|seit|depuis)\\s+(${point})(?![\\p{L}\\d])`,
  'iu',
)
// Looser than the range: a year or month joined by a dash to another year or
// an ongoing word marks a role date line even when the range does not parse,
// such as "Summer 2019 – Fall 2020".
const looseDateLine = new RegExp(
  `(?<![\\p{L}\\d])(?:${year}|${month})\\s*[-–—]\\s*(?:\\p{L}+\\.?\\s+)?(?:${year}|${present})`,
  'iu',
)

/** Whether a line carries a role's date range, parsed or not. */
export function isDateLine(text: string): boolean {
  return (
    rangePattern.test(text) ||
    sincePattern.test(text) ||
    looseDateLine.test(text)
  )
}

export function parseDateRange(text: string): DateRange | undefined {
  const since = sincePattern.exec(text)?.[1]
  if (since !== undefined) {
    const start = parseDatePoint(since)
    return start === undefined ? undefined : { start, end: 'present' }
  }

  const match = rangePattern.exec(text)
  if (match === null) return undefined
  const [, startText = '', endText = ''] = match

  const start = parseDatePoint(startText)
  if (start === undefined) return undefined
  if (new RegExp(`^${present}$`, 'iu').test(endText))
    return { start, end: 'present' }

  const end = parseDatePoint(endText)
  if (end === undefined || compareDates(start, end) > 0) return undefined
  return { start, end }
}

function parseDatePoint(text: string): DatePoint | undefined {
  const trimmed = text.trim().toLowerCase()
  const numeric = /^(\d{1,2})[/.](\d{4})$/.exec(trimmed)
  if (numeric !== null)
    return { year: Number(numeric[2]), month: Number(numeric[1]) }

  const named = /^([\p{L}']+)\.?\s+(\d{4})$/u.exec(trimmed)
  if (named !== null) {
    const monthNumber = monthNames[named[1] ?? '']
    return monthNumber === undefined
      ? undefined
      : { year: Number(named[2]), month: monthNumber }
  }

  return /^\d{4}$/.test(trimmed) ? { year: Number(trimmed) } : undefined
}

function compareDates(a: DatePoint, b: DatePoint): number {
  return a.year - b.year || (a.month ?? 1) - (b.month ?? 12)
}
