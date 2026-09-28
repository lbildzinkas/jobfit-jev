// CV sectioning and header stripping (docs/spec.md §4.3 steps 2–7) on
// synthetic CVs with varied headers. Every person and detail is invented.

import { describe, expect, it } from 'vitest'
import { buildLines } from '../../src/core/cv/lines'
import { emptyCorrections, parseCv, parseNewCv } from '../../src/core/cv/parse'
import type { CvCorrections, CvLine, StrippedCv } from '../../src/core/cv/types'
import { classicCv, cvLines, person } from './synthetic'

const withCorrections = (lines: CvLine[], change: Partial<CvCorrections>) =>
  parseCv(lines, { ...parseNewCv(lines).corrections, ...change })

function strippedTexts(stripped: StrippedCv): string[] {
  return [
    ...stripped.summary,
    ...stripped.roles.flatMap((role) => [...role.header, ...role.lines]),
    ...stripped.education,
    ...stripped.skills,
    ...stripped.other,
  ].map((line) => line.text)
}

describe('header stripping', () => {
  it('strips everything above the first recognized heading', () => {
    const { parsed } = parseNewCv(classicCv)
    expect(parsed.headerEnd).toBe(4)
    expect(parsed.noHeadingFound).toBe(false)
    const sent = strippedTexts(parsed.stripped).join('\n')
    expect(sent).not.toContain('Senior Software Engineer')
    expect(sent).not.toContain('Springfield')
  })

  it('pre-fills the name and address for the owner to confirm', () => {
    expect(parseNewCv(classicCv).corrections).toMatchObject({
      name: person.name,
      addresses: [person.address, 'IL 62701'],
    })
  })

  it('highlights every personal detail in the header', () => {
    const { parsed } = parseNewCv(classicCv)
    const kinds = parsed.statuses
      .slice(0, parsed.headerEnd)
      .flatMap((status) =>
        'pii' in status ? status.pii.map((span) => span.kind) : [],
      )
    expect(new Set(kinds)).toEqual(
      new Set(['name', 'email', 'phone', 'address', 'link']),
    )
  })

  it.each([
    [
      'a letter-spaced heading and a location line',
      cvLines([
        ['MIRA TESTOVA', 22],
        'Platform Engineer · Exampleton, Sampleland',
        'mira.testova@example.org · +44 7700 900321',
        ['P R O F I L E', 12],
        'Platform engineer focused on developer tooling.',
        ['W O R K   E X P E R I E N C E', 12],
        'Platform Engineer, Fabrikam',
        '2019 – Present',
        '• Built the internal CI platform used by 300 engineers.',
      ]),
      [
        'MIRA TESTOVA',
        'mira.testova@example.org',
        '+44 7700 900321',
        'Exampleton',
      ],
      'MIRA TESTOVA',
    ],
    [
      'pasted text with capitalized headings and labels',
      cvLines([
        ['Alex Example-Person', 0],
        ['Tel: 555.010.9988 | Email: alex.person@example.net', 0],
        ['Portfolio: https://alexperson.example.com/work', 0],
        ['SUMMARY', 0],
        ['Data engineer who builds batch and streaming pipelines.', 0],
        ['WORK HISTORY', 0],
        ['Data Engineer at Tailspin Toys, 03/2018 — 11/2021', 0],
        ['- Moved nightly batch jobs to Spark Structured Streaming.', 0],
        ['EDUCATION & TRAINING', 0],
        ['MSc Data Science, Sample Institute, 2016 – 2018', 0],
      ]),
      [
        'Alex Example-Person',
        '555.010.9988',
        'alex.person@example.net',
        'alexperson.example.com',
      ],
      'Alex Example-Person',
    ],
    [
      'contact details in the footer, not the header',
      cvLines([
        [person.name, 18],
        ['Experience', 12],
        'Staff Engineer, Northwind Payments, Jan 2021 – Present',
        '• Led the ledger migration.',
        ['Skills', 12],
        'Go, Kafka',
        `Contact: ${person.email} · ${person.phone} · ${person.github}`,
      ]),
      [person.email, person.phone, person.github, person.name],
      person.name,
    ],
  ])('strips a header with %s', (_, lines, secrets, name) => {
    const { parsed, corrections } = parseNewCv(lines)
    expect(corrections.name).toBe(name)
    const sent = JSON.stringify(parsed.stripped)
    for (const secret of secrets) expect(sent).not.toContain(secret)
    expect(parsed.stripped.roles).toHaveLength(1)
  })

  it('reads a two-column PDF layout with contacts in the sidebar', () => {
    const run = (text: string, x: number, y: number, fontSize = 10) => ({
      text,
      x,
      y,
      width: text.length * fontSize * 0.5,
      fontSize,
    })
    const lines = buildLines({
      hasImageOnFirstPage: false,
      pages: [
        {
          runs: [
            run(person.name, 40, 750, 20),
            run('Experience', 220, 702, 12),
            run('Contact', 40, 700, 12),
            run('Staff Engineer, Northwind', 220, 684),
            run(person.email, 40, 682, 7),
            run('Jan 2021 – Present', 220, 670),
            run(person.phone, 40, 668, 7),
            run('• Built the ledger service in Go.', 220, 656),
            run('Skills', 40, 640, 12),
            run('• Ran the on-call rotation.', 220, 642),
            run('Go, Kafka, Terraform', 40, 624),
            run('Education', 220, 610, 12),
            run('BSc Computer Science, 2012 – 2016', 220, 596),
          ],
        },
      ],
    })
    const { parsed } = parseNewCv(lines)
    const sent = JSON.stringify(parsed.stripped)
    for (const secret of [person.name, person.email, person.phone])
      expect(sent).not.toContain(secret)
    expect(parsed.stripped.skills.map((line) => line.text)).toEqual([
      'Go, Kafka, Terraform',
    ])
    expect(parsed.stripped.roles[0]?.lines.map((line) => line.text)).toEqual([
      '• Built the ledger service in Go.',
      '• Ran the on-call rotation.',
    ])
  })

  it('treats everything as header when no heading is recognized', () => {
    const lines = cvLines([person.name, 'Builds things.', 'Go, Kafka'])
    const { parsed } = parseNewCv(lines)
    expect(parsed.noHeadingFound).toBe(true)
    expect(parsed.headerEnd).toBe(3)
    expect(strippedTexts(parsed.stripped)).toEqual([])
  })
})

describe('PII sweep over the whole CV', () => {
  it('removes a link from a body line and keeps the rest', () => {
    const { parsed } = parseNewCv(classicCv)
    expect(strippedTexts(parsed.stripped)).toContain(
      '• Maintained the public SDK, documented at.',
    )
  })

  it('removes the confirmed name from the body', () => {
    const { parsed } = parseNewCv(classicCv)
    expect(strippedTexts(parsed.stripped)).toContain(
      'References available from on request.',
    )
  })

  it('drops a body line left empty', () => {
    const lines = cvLines([person.name, ['Skills', 12], 'Go', person.github])
    const { parsed } = parseNewCv(lines)
    expect(strippedTexts(parsed.stripped)).toEqual(['Go'])
  })
})

describe('protected-attribute withholding', () => {
  it('withholds protected lines anywhere in the body, with the reason', () => {
    const { parsed } = parseNewCv(classicCv)
    const withheld = parsed.statuses.flatMap((status, index) =>
      status.kind === 'withheld' ? [[index, status.category]] : [],
    )
    expect(withheld).toEqual([
      [21, 'birth_or_age'],
      [22, 'nationality'],
      [23, 'family_status'],
    ])
    const sent = strippedTexts(parsed.stripped).join('\n')
    expect(sent).not.toMatch(/birth|Nationality|Marital/)
  })
})

describe('protected text that looks like a heading', () => {
  it('is withheld, not kept as a section heading', () => {
    const lines = cvLines([
      person.name,
      ['Skills', 12],
      'Go, Kafka',
      'NATIONALITY: EXAMPLEAN',
      'English, Spanish',
    ])
    const { parsed } = parseNewCv(lines)
    expect(parsed.statuses[3]).toMatchObject({
      kind: 'withheld',
      category: 'nationality',
    })
    expect(JSON.stringify(parsed.stripped)).not.toContain('EXAMPLEAN')
  })

  it('is withheld when the owner marks a heading private', () => {
    const parsed = withCorrections(classicCv, { privateLines: [18] })
    expect(parsed.statuses[18]).toMatchObject({ category: 'marked_private' })
    expect(strippedTexts(parsed.stripped)).not.toContain('Languages')
  })
})

describe('sectioning', () => {
  it('finds dictionary and layout headings', () => {
    const { parsed } = parseNewCv(classicCv)
    expect(
      parsed.sections.map((section) => [
        section.kind,
        section.heading,
        section.source,
      ]),
    ).toEqual([
      ['summary', 'Summary', 'dictionary'],
      ['experience', 'Experience', 'dictionary'],
      ['education', 'Education', 'dictionary'],
      ['skills', 'Skills', 'dictionary'],
      ['other', 'Languages', 'dictionary'],
      ['other', 'Personal details', 'layout'],
    ])
  })

  it('does not take a capitalized role title for a heading', () => {
    const lines = cvLines([
      person.name,
      ['EXPERIENCE', 10],
      'STAFF ENGINEER',
      'Northwind Payments | Jan 2021 – Present',
      '• Led the ledger migration.',
    ])
    const { parsed } = parseNewCv(lines)
    expect(parsed.sections).toHaveLength(1)
    expect(parsed.stripped.roles[0]?.header.map((line) => line.text)).toEqual([
      'STAFF ENGINEER',
      'Northwind Payments | Jan 2021 – Present',
    ])
  })

  it('keeps an unknown heading as a generic section', () => {
    const lines = cvLines([
      person.name,
      ['Summary', 14],
      'Engineer.',
      ['Open-Source Maintainership', 14],
      'Maintainer of a queue library.',
    ])
    const { parsed } = parseNewCv(lines)
    expect(parsed.sections[1]).toMatchObject({
      kind: 'other',
      heading: 'Open-Source Maintainership',
      source: 'layout',
    })
    expect(strippedTexts(parsed.stripped)).toContain(
      'Open-Source Maintainership',
    )
  })
})

describe('roles', () => {
  it('splits experience into roles with parsed dates', () => {
    const { parsed } = parseNewCv(classicCv)
    const roles = parsed.stripped.roles.map((role) => ({
      header: role.header.map((line) => line.text),
      lines: role.lines.length,
      dates: role.dates,
      datesUnparsed: role.datesUnparsed,
    }))
    expect(roles).toEqual([
      {
        header: ['Staff Engineer, Northwind Payments', 'Jan 2021 – Present'],
        lines: 2,
        dates: { start: { year: 2021, month: 1 }, end: 'present' },
        datesUnparsed: false,
      },
      {
        header: ['Software Engineer | Contoso Retail | Mar 2016 – Dec 2020'],
        lines: 2,
        dates: {
          start: { year: 2016, month: 3 },
          end: { year: 2020, month: 12 },
        },
        datesUnparsed: false,
      },
    ])
  })

  it('takes the title line after a date-only line', () => {
    const lines = cvLines([
      person.name,
      ['Experience', 12],
      'Jan 2021 – Present',
      'Staff Engineer, Northwind Payments',
      '• Led the ledger migration.',
    ])
    const [role] = parseNewCv(lines).parsed.stripped.roles
    expect(role?.header.map((line) => line.text)).toEqual([
      'Jan 2021 – Present',
      'Staff Engineer, Northwind Payments',
    ])
    expect(role?.lines.map((line) => line.text)).toEqual([
      '• Led the ledger migration.',
    ])
  })

  it('keeps a role whose dates do not parse, marked datesUnparsed', () => {
    const lines = cvLines([
      person.name,
      ['Experience', 12],
      'Research Assistant, Sample Lab',
      'Summer 2019 – Fall 2020',
      '• Wrote the data pipeline.',
    ])
    const [role] = parseNewCv(lines).parsed.stripped.roles
    expect(role).toMatchObject({ datesUnparsed: true })
    expect(role?.dates).toBeUndefined()
    expect(role?.header).toHaveLength(2)
  })
})

describe('line IDs', () => {
  it('numbers every kept body line in reading order', () => {
    const { parsed } = parseNewCv(classicCv)
    const all = [
      ...parsed.stripped.summary,
      ...parsed.stripped.roles.flatMap((role) => [
        ...role.header,
        ...role.lines,
      ]),
      ...parsed.stripped.education,
      ...parsed.stripped.skills,
      ...parsed.stripped.other,
    ].sort((a, b) => a.source - b.source)
    expect(all.map((line) => line.id)).toEqual(
      all.map((_, index) => `L${String(index).padStart(3, '0')}`),
    )
    expect(parsed.stripped.summary[0]?.id).toBe('L000')
  })

  it('gives the same IDs on every parse', () => {
    const first = parseNewCv(classicCv).parsed.stripped
    const second = parseNewCv(classicCv).parsed.stripped
    expect(second).toEqual(first)
  })
})

describe('owner corrections', () => {
  it('moves the header boundary down', () => {
    const parsed = withCorrections(classicCv, { headerEnd: 6 })
    expect(parsed.stripped.summary).toEqual([])
  })

  it('moves the header boundary up and still sweeps the contact line', () => {
    const parsed = withCorrections(classicCv, { headerEnd: 1 })
    const sent = strippedTexts(parsed.stripped)
    expect(sent).toContain('Senior Software Engineer')
    expect(sent.join('\n')).not.toMatch(/example\.com|555|linkedin|github/)
    expect(parsed.sections[0]).toMatchObject({
      source: 'no_heading',
      kind: 'summary',
    })
  })

  it('withholds lines marked private and restores released ones', () => {
    const parsed = withCorrections(classicCv, {
      privateLines: [19],
      releasedLines: [22],
    })
    const sent = strippedTexts(parsed.stripped)
    expect(sent).not.toContain('English (native), Spanish (professional)')
    expect(sent).toContain('Nationality: Examplean')
    expect(parsed.statuses[19]).toMatchObject({
      kind: 'withheld',
      category: 'marked_private',
    })
  })

  it('adds and removes headings and changes a section kind', () => {
    const parsed = withCorrections(classicCv, {
      removedHeadings: [20],
      addedHeadings: [24],
      sectionKinds: { 18: 'skills' },
    })
    expect(
      parsed.sections.map((section) => [section.heading, section.kind]),
    ).toContainEqual(['Languages', 'skills'])
    expect(parsed.sections.map((section) => section.heading)).not.toContain(
      'Personal details',
    )
    expect(parsed.sections.at(-1)).toMatchObject({
      source: 'owner',
      headingLine: 24,
    })
    expect(parsed.stripped.skills.map((line) => line.text)).toContain(
      'English (native), Spanish (professional)',
    )
  })

  it('strips extra private strings everywhere', () => {
    const parsed = withCorrections(classicCv, {
      privateStrings: ['Northwind Payments'],
    })
    expect(strippedTexts(parsed.stripped).join('\n')).not.toContain('Northwind')
  })

  it('starts from empty corrections', () => {
    expect(parseCv(classicCv, emptyCorrections).nameCandidate).toBe(person.name)
  })
})

// Property-style check (docs/spec.md §11.1): across many generated CVs, no
// email, phone number, URL, or confirmed name survives into the state that
// could be sent.
describe('nothing personal survives stripping', () => {
  const firstNames = ['Jordan', 'Mira', 'Alex', 'Sam', 'Noor', 'Ines', 'Kai']
  const lastNames = [
    'Sample',
    'Testova',
    'Example-Person',
    'Placeholder',
    'Demo',
  ]
  const domains = [
    'example.com',
    'example.org',
    'example.net',
    'mail.example.com',
  ]

  function random(seed: number) {
    let state = seed
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
  }

  function makeCase(seed: number) {
    const next = random(seed)
    const pick = <T>(items: T[]): T =>
      items[Math.floor(next() * items.length)] as T
    const digits = (count: number) =>
      Array.from({ length: count }, () => String(Math.floor(next() * 10))).join(
        '',
      )
    const first = pick(firstNames)
    const last = pick(lastNames)
    const name = `${first} ${last}`
    const handle = `${first}-${last}-${digits(3)}`.toLowerCase()
    const email = `${first}.${last}${digits(2)}@${pick(domains)}`.toLowerCase()
    const phone = pick([
      `+1 (555) 01${digits(1)}-${digits(4)}`,
      `+44 7700 900${digits(3)}`,
      `(555) 01${digits(1)}-${digits(4)}`,
      `555.01${digits(1)}.${digits(4)}`,
      `+55 11 9${digits(4)}-${digits(4)}`,
    ])
    const url = pick([
      `https://github.com/${handle}`,
      `linkedin.com/in/${handle}`,
      `www.${handle}.example.com`,
      `https://${handle}.example.org/portfolio`,
    ])
    const secrets = { name, email, phone, url }
    const placements = [
      `${email} | ${phone}`,
      url,
      `Reach me at ${email}.`,
      `• Published notes at ${url}, cited by ${name}.`,
      `Call ${phone} for references.`,
      `${name} — ${url}`,
    ]
    const body = [
      ['Summary', 13],
      pick(placements),
      'Engineer building reliable backend systems in Go and Python.',
      ['Experience', 13],
      'Staff Engineer, Northwind Payments',
      'Jan 2021 – Present',
      pick(placements),
      '• Led the migration of the ledger service to Kubernetes.',
      ['Skills', 13],
      'Go, Python, Kafka',
      pick(placements),
    ] satisfies (string | [string, number])[]
    const lines = cvLines([[name, 20], `${email} · ${phone}`, url, ...body])
    return { lines, secrets }
  }

  it.each(Array.from({ length: 40 }, (_, seed) => seed + 1))(
    'case %i',
    (seed) => {
      const { lines, secrets } = makeCase(seed)
      const { parsed } = parseNewCv(lines)
      const sent = JSON.stringify(parsed.stripped).toLowerCase()
      for (const secret of Object.values(secrets))
        expect(sent).not.toContain(secret.toLowerCase())
      expect(sent).not.toMatch(/https?:|www\.|@/)
    },
  )
})
