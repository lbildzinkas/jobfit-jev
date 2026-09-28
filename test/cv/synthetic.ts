// Synthetic CVs for the parser and stripper tests. Every person, address,
// phone number, email, and link here is invented: emails use the reserved
// example domains and phone numbers the ranges set aside for fiction.

import type { CvLine } from '../../src/core/cv/types'

/** `[text, fontSize]` pairs; a bare string is body text at size 10. */
type LineSpec = string | [string, number]

export function cvLines(specs: LineSpec[]): CvLine[] {
  return specs.map((spec, index) => {
    const [text, fontSize] = typeof spec === 'string' ? [spec, 10] : spec
    return { index, page: 1, text, fontSize }
  })
}

export const person = {
  name: 'Jordan Q. Sample',
  email: 'jordan.sample@example.com',
  phone: '+1 (555) 010-4477',
  address: '123 Example Street',
  linkedin: 'linkedin.com/in/jordan-sample-example',
  github: 'https://github.com/jordan-sample-example',
  website: 'jordansample.dev',
}

/** A conventional one-column CV with a contact header. */
export const classicCv = cvLines([
  [person.name, 20],
  'Senior Software Engineer',
  `${person.email} | ${person.phone} | ${person.address}, Springfield, IL 62701`,
  `${person.linkedin} · ${person.github}`,
  ['Summary', 13],
  'Backend engineer with eight years of experience building payment systems in Go and Python.',
  ['Experience', 13],
  'Staff Engineer, Northwind Payments',
  'Jan 2021 – Present',
  '• Led the migration of the ledger service to Kubernetes, cutting deploy time by 70%.',
  '• Designed an idempotent event pipeline on Kafka processing 2M events per day.',
  'Software Engineer | Contoso Retail | Mar 2016 – Dec 2020',
  '• Built the checkout API in Python and PostgreSQL.',
  `• Maintained the public SDK, documented at ${person.website}/sdk.`,
  ['Education', 13],
  'BSc Computer Science, Example State University, 2012 – 2016',
  ['Skills', 13],
  'Go, Python, PostgreSQL, Kafka, Kubernetes, Terraform, AWS',
  ['Languages', 13],
  'English (native), Spanish (professional)',
  ['Personal details', 13],
  'Date of birth: 04/05/1990',
  'Nationality: Examplean',
  'Marital status: married, two children',
  `References available from ${person.name} on request.`,
])
