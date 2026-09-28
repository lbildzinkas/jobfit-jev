// Protected-attribute withholding (docs/spec.md §4.3 step 6).

import { describe, expect, it } from 'vitest'
import { findProtected } from '../../src/core/cv/protected'

describe('findProtected', () => {
  it.each([
    ['Date of birth: 04/05/1990', 'birth_or_age'],
    ['DOB: 1990-05-04', 'birth_or_age'],
    ['Age: 34', 'birth_or_age'],
    ['34 years old, based in Springfield', 'birth_or_age'],
    ['Born in 1990 in Examplestadt', 'birth_or_age'],
    ['Data de nascimento: 04/05/1990', 'birth_or_age'],
    ['Geburtsdatum: 04.05.1990', 'birth_or_age'],
    ['Gender: female', 'gender'],
    ['Pronouns: they/them', 'gender'],
    ['Marital status: married', 'family_status'],
    ['Married with two children', 'family_status'],
    ['Estado civil: casado', 'family_status'],
    ['Familienstand: verheiratet', 'family_status'],
    ['Nationality: Examplean', 'nationality'],
    ['Dual citizen of Exampleland and Sampleland', 'nationality'],
    ['Nacionalidade: exemplense', 'nationality'],
    ['Visa status: H-1B', 'work_authorization'],
    ['Authorized to work in the EU without sponsorship', 'work_authorization'],
    ['Religion: none', 'religion'],
    ['Ethnicity: prefer not to say', 'ethnicity'],
    ['Health: good', 'health_or_disability'],
    ['Disability: none declared', 'health_or_disability'],
    ['Photo: attached', 'photo'],
    ['Languages: English | Nationality: Examplean', 'nationality'],
  ])('withholds %s', (text, category) => {
    expect(findProtected(text)?.category).toBe(category)
  })

  it.each([
    'Built a digital health platform for 40 clinics.',
    'Visa – Payments Platform, Staff Engineer',
    'Senior Engineer, Visa Inc. (2019 – 2021)',
    'Single-page app in React and TypeScript',
    'Led a team of 5 engineers; 3 years of Go.',
    'Implemented accessibility for keyboard and screen-reader users.',
    'Managed stage and age-gated content rollouts',
    'Languages: English (native), Spanish (professional)',
  ])('keeps %s', (text) => {
    expect(findProtected(text)).toBeUndefined()
  })

  it('reports the matched words', () => {
    expect(findProtected('Nationality: Examplean')).toEqual({
      category: 'nationality',
      match: 'Nationality',
    })
  })
})
