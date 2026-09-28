// Protected-attribute withholding (docs/spec.md §4.3 step 6): lines that
// state date of birth or age, gender, family status, nationality or
// citizenship, work authorization, religion, ethnicity, health or
// disability, or caption a photo are withheld from the model. English first,
// with Portuguese, Spanish, German, and French labels.
//
// A label followed by a colon ("Nationality: …") is always withheld. Bare
// words are withheld only where they cannot be ordinary work vocabulary, so
// "digital health platform" stays while "Health: …" goes.

import type { ProtectedCategory } from './types'

export interface ProtectedMatch {
  category: Exclude<ProtectedCategory, 'marked_private'>
  match: string
}

type Rule = [ProtectedMatch['category'], string[]]

// Labels: withheld when followed by ":" and a value. A dash is not enough:
// "Visa – Payments team" names an employer.
const labels: Rule[] = [
  [
    'birth_or_age',
    [
      'date of birth',
      'birth date',
      'birthdate',
      'dob',
      'd\\.o\\.b\\.?',
      'birthday',
      'born',
      'place of birth',
      'age',
      'data de nascimento',
      'nascimento',
      'idade',
      'fecha de nacimiento',
      'edad',
      'geburtsdatum',
      'geboren',
      'alter',
      'date de naissance',
      'né le',
      'née le',
    ],
  ],
  [
    'gender',
    [
      'gender',
      'sex',
      'pronouns',
      'sexo',
      'género',
      'gênero',
      'geschlecht',
      'sexe',
      'genre',
    ],
  ],
  [
    'family_status',
    [
      'marital status',
      'civil status',
      'family status',
      'family',
      'children',
      'kids',
      'dependents',
      'dependants',
      'spouse',
      'estado civil',
      'filhos',
      'hijos',
      'familienstand',
      'kinder',
      'situation familiale',
      'état civil',
      'enfants',
    ],
  ],
  [
    'nationality',
    [
      'nationality',
      'nationalities',
      'citizenship',
      'citizen',
      'nacionalidade',
      'naturalidade',
      'nacionalidad',
      'staatsangehörigkeit',
      'nationalität',
      'nationalité',
    ],
  ],
  [
    'work_authorization',
    [
      'visa',
      'visa status',
      'work permit',
      'residence permit',
      'work authorization',
      'work authorisation',
      'right to work',
      'green card',
      'aufenthaltstitel',
      'arbeitserlaubnis',
      'permiso de trabajo',
      'visto',
    ],
  ],
  [
    'religion',
    [
      'religion',
      'religious affiliation',
      'faith',
      'religião',
      'religión',
      'konfession',
      'religion',
    ],
  ],
  [
    'ethnicity',
    ['ethnicity', 'ethnic origin', 'race', 'etnia', 'raça', 'ethnie'],
  ],
  [
    'health_or_disability',
    [
      'health',
      'health status',
      'disability',
      'disabilities',
      'medical conditions',
      'saúde',
      'deficiência',
      'salud',
      'discapacidad',
      'behinderung',
      'gesundheit',
      'santé',
      'handicap',
    ],
  ],
  ['photo', ['photo', 'photograph', 'picture', 'foto']],
]

// Phrases withheld wherever they appear.
const phrases: Rule[] = [
  [
    'birth_or_age',
    [
      'date of birth',
      'born (?:on|in)',
      '\\d{1,2} years old',
      '\\d{1,2} years of age',
      'aged \\d{1,2}',
      '\\d{1,2} anos de idade',
      '\\d{1,2} años de edad',
      '\\d{1,2} jahre alt',
    ],
  ],
  ['gender', ['he/him', 'she/her', 'they/them']],
  [
    'family_status',
    [
      'marital status',
      'married(?: with| and)? (?:\\d|one|two|three|children|kids)',
      '(?:single|married|divorced|widowed)(?:,| and| with)? (?:\\d|one|two|three|no) (?:children|kids)',
      '(?:father|mother) of (?:\\d|one|two|three|four)',
      'casad[oa]',
      'verheiratet',
      'ledig',
      'marié(?:e)?',
    ],
  ],
  [
    'nationality',
    [
      'nationality',
      'citizenship',
      '(?:citizen|national) of',
      'dual citizen',
      'passport holder',
    ],
  ],
  [
    'work_authorization',
    [
      'visa status',
      'work permit',
      'residence permit',
      'green card',
      'authori[sz]ed to work',
      'requires? (?:visa )?sponsorship',
      '(?:h-1b|h1b|l-1|tn|o-1) visa',
      'blue card',
    ],
  ],
  ['religion', ['religious affiliation']],
  ['ethnicity', ['ethnic origin', 'ethnicity']],
  [
    'health_or_disability',
    [
      'health status',
      'medical condition',
      'chronic illness',
      'disabled person',
      'registered disabled',
    ],
  ],
]

const labelPatterns = labels.map(([category, terms]) => ({
  category,
  pattern: new RegExp(
    `(?:^|[|·•]\\s*)(${terms.join('|')})\\s*(?:\\([^)]*\\)\\s*)?[:：]\\s*\\S`,
    'iu',
  ),
}))

const phrasePatterns = phrases.map(([category, terms]) => ({
  category,
  pattern: new RegExp(
    `(?<![\\p{L}\\d])(?:${terms.join('|')})(?![\\p{L}])`,
    'iu',
  ),
}))

export function findProtected(text: string): ProtectedMatch | undefined {
  for (const { category, pattern } of [...labelPatterns, ...phrasePatterns]) {
    const match = pattern.exec(text)
    if (match !== null)
      return { category, match: (match[1] ?? match[0]).trim() }
  }
  return undefined
}

export const protectedCategoryLabels: Record<ProtectedCategory, string> = {
  birth_or_age: 'date of birth or age',
  gender: 'gender',
  family_status: 'marital or family status',
  nationality: 'nationality or citizenship',
  work_authorization: 'work authorization (belongs in eligibility facts)',
  religion: 'religion',
  ethnicity: 'ethnicity',
  health_or_disability: 'health or disability',
  photo: 'photo caption',
  marked_private: 'marked private by you',
}
