// The PII sweep (docs/spec.md §4.3 step 5). All values are invented.

import { describe, expect, it } from 'vitest'
import { findPii, removeSpans, type SweepTerms } from '../../src/core/cv/pii'

const noTerms: SweepTerms = {
  names: [],
  addresses: [],
  privateStrings: [],
  releasedStrings: [],
}

const found = (text: string, terms: Partial<SweepTerms> = {}) =>
  findPii(text, { ...noTerms, ...terms }).map(({ kind, text: value }) => [
    kind,
    value,
  ])

const strip = (text: string, terms: Partial<SweepTerms> = {}) =>
  removeSpans(text, findPii(text, { ...noTerms, ...terms }))

describe('findPii', () => {
  it.each([
    ['jordan.sample@example.com'],
    ['j.q.sample+cv@mail.example.org'],
    ['jördan@exämple.de'],
  ])('finds the email %s', (email) => {
    expect(found(`Email: ${email}`)).toEqual([['email', email]])
  })

  it.each([
    ['+1 (555) 010-4477'],
    ['(555) 010-4477'],
    ['+44 7700 900123'],
    ['07700 900123'],
    ['+55 11 95555-0123'],
    ['+49 30 1234 5678'],
    ['555.010.4477'],
  ])('finds the phone number %s', (phone) => {
    expect(found(`Phone ${phone}`)).toEqual([['phone', phone]])
  })

  it.each([
    ['2016 - 2020'],
    ['01.2019 - 03.2021'],
    ['2012 2016 2020'],
    ['processing 2000000 events'],
  ])('does not take %s for a phone number', (text) => {
    expect(found(text)).toEqual([])
  })

  it.each([
    ['https://github.com/jordan-sample-example'],
    ['http://jordansample.example.net/cv'],
    ['www.jordansample.dev'],
    ['linkedin.com/in/jordan-sample-example'],
    ['github.com/jordan-sample-example'],
    ['jordansample.dev'],
    ['@jordansample_dev'],
  ])('finds the link %s', (link) => {
    expect(found(`See ${link}`)).toEqual([['link', link]])
  })

  it.each([
    ['123 Example Street'],
    ['42 Sample Rd., Apt 4B'],
    ['Rua dos Exemplos, 123'],
    ['Beispielstraße 12'],
    ['01234-567'],
    ['IL 62701'],
  ])('finds the address %s', (address) => {
    expect(found(`Lives at ${address}`)).toEqual([['address', address]])
  })

  it.each([
    'Built services in ASP.NET, Node.js, and Vue.js.',
    'Cut p99 latency from 800ms to 120ms across 3 regions.',
    'Ran Kubernetes on AWS (EKS) with S3 and 5GB volumes.',
    'Led a team of 12 in 4 time zones.',
    'Spring 2019 hackathon winner',
  ])('leaves work text alone: %s', (text) => {
    expect(found(text)).toEqual([])
  })

  it('finds the owner-confirmed name and address in any case', () => {
    expect(
      found('Recommended by JORDAN Q. SAMPLE at 7 Quiet Lane', {
        names: ['Jordan Q. Sample'],
        addresses: ['7 Quiet Lane'],
      }),
    ).toEqual([
      ['name', 'JORDAN Q. SAMPLE'],
      ['address', '7 Quiet Lane'],
    ])
  })

  it('finds extra strings the owner marked private', () => {
    expect(
      found('Member of the Example Club', { privateStrings: ['Example Club'] }),
    ).toEqual([['private', 'Example Club']])
  })

  it('leaves out detected text the owner released', () => {
    expect(
      found('Maintainer of socket.io plugins', {
        releasedStrings: ['socket.io'],
      }),
    ).toEqual([])
  })

  it('does not let a release cover a confirmed name', () => {
    expect(
      found('By Jordan Q. Sample', {
        names: ['Jordan Q. Sample'],
        releasedStrings: ['Jordan Q. Sample'],
      }),
    ).toEqual([['name', 'Jordan Q. Sample']])
  })

  it('keeps trailing punctuation out of a link', () => {
    expect(found('Docs at jordansample.dev/sdk.')).toEqual([
      ['link', 'jordansample.dev/sdk'],
    ])
  })
})

describe('removeSpans', () => {
  it('drops the spans and the separators they leave behind', () => {
    expect(
      strip('jordan.sample@example.com | +1 (555) 010-4477 | Springfield'),
    ).toBe('Springfield')
  })

  it('keeps the rest of a sentence and its bullet', () => {
    expect(
      strip('• Maintained the SDK, documented at jordansample.dev/sdk.'),
    ).toBe('• Maintained the SDK, documented at.')
  })

  it('empties a line that held only personal details', () => {
    expect(
      strip(
        'linkedin.com/in/jordan-sample-example · https://github.com/jordan-sample-example',
      ),
    ).toBe('')
  })

  it('returns a line without spans unchanged', () => {
    expect(strip('- Built the checkout API.')).toBe('- Built the checkout API.')
  })
})
