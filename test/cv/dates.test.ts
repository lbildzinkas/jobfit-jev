// Role date ranges (docs/spec.md §4.3 step 3).

import { describe, expect, it } from 'vitest'
import { isDateLine, parseDateRange } from '../../src/core/cv/dates'

describe('parseDateRange', () => {
  it.each([
    ['Jan 2021 – Present', { start: { year: 2021, month: 1 }, end: 'present' }],
    [
      'Sept. 2016 - Dec 2020',
      { start: { year: 2016, month: 9 }, end: { year: 2020, month: 12 } },
    ],
    [
      'March 2019 to June 2020',
      { start: { year: 2019, month: 3 }, end: { year: 2020, month: 6 } },
    ],
    ['2012–2016', { start: { year: 2012 }, end: { year: 2016 } }],
    [
      '03/2018 — 11/2019',
      { start: { year: 2018, month: 3 }, end: { year: 2019, month: 11 } },
    ],
    [
      '01.2019 - 03.2021',
      { start: { year: 2019, month: 1 }, end: { year: 2021, month: 3 } },
    ],
    [
      'Staff Engineer | Northwind | May 2020 – current',
      { start: { year: 2020, month: 5 }, end: 'present' },
    ],
    ['fev 2020 – atual', { start: { year: 2020, month: 2 }, end: 'present' }],
    [
      'septiembre 2017 - marzo 2019',
      { start: { year: 2017, month: 9 }, end: { year: 2019, month: 3 } },
    ],
    ['Okt 2015 – heute', { start: { year: 2015, month: 10 }, end: 'present' }],
    [
      'févr. 2014 – août 2016',
      { start: { year: 2014, month: 2 }, end: { year: 2016, month: 8 } },
    ],
    ['Since 2019', { start: { year: 2019 }, end: 'present' }],
  ])('parses %s', (text, expected) => {
    expect(parseDateRange(text)).toEqual(expected)
  })

  it.each([
    ['a range that runs backwards', '2020 – 2016'],
    ['a season instead of a month', 'Summer 2019 – Fall 2020'],
    ['no date at all', 'Staff Engineer, Northwind Payments'],
  ])('does not parse %s', (_, text) => {
    expect(parseDateRange(text)).toBeUndefined()
  })
})

describe('isDateLine', () => {
  it.each([
    'Jan 2021 – Present',
    'Summer 2019 – Fall 2020',
    '2012 - 2016',
    'Jun – Present',
  ])('recognizes %s as a role date line', (text) => {
    expect(isDateLine(text)).toBe(true)
  })

  it.each([
    'Led the 2019 migration, then moved teams.',
    'Reduced costs by 30% - saving $2M',
    'Go, Python, PostgreSQL',
  ])('does not treat %s as a date line', (text) => {
    expect(isDateLine(text)).toBe(false)
  })
})
