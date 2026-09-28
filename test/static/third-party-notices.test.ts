// Every package bundled into the extension must carry a permissive license
// and be listed in THIRD_PARTY_NOTICES.md (docs/spec.md §12).
import { describe, expect, it } from 'vitest'
import { readRepoFile } from './scan-source'

const lockfile = JSON.parse(readRepoFile('package-lock.json')) as {
  packages: Record<string, { dev?: boolean; license?: string }>
}
const listedPackages = new Set(
  readRepoFile('THIRD_PARTY_NOTICES.md')
    .split('\n')
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice('### '.length).trim()),
)

// pdfjs-dist's optional @napi-rs/canvas is a native Node.js addon that pdf.js
// loads through createRequire only when running under Node.js; the browser
// build never imports it, so it is not bundled into the extension.
const nodeOnlyPackages = /^@napi-rs\/canvas(?:-|$)/

const bundledPackages = Object.entries(lockfile.packages)
  .filter(([path, entry]) => path !== '' && entry.dev !== true)
  .map(([path, entry]) => ({
    name: path.slice(
      path.lastIndexOf('node_modules/') + 'node_modules/'.length,
    ),
    license: entry.license,
  }))
  .filter(({ name }) => !nodeOnlyPackages.test(name))

describe('bundled packages', () => {
  it('include the UI runtime and the PDF reader', () => {
    expect(bundledPackages.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['react', 'pdfjs-dist']),
    )
  })

  it('use MIT, Apache-2.0, or BSD licenses', () => {
    const disallowed = bundledPackages.filter(
      ({ license }) => !allowedLicenses.has(license ?? ''),
    )
    expect(disallowed).toEqual([])
  })

  it('are listed in THIRD_PARTY_NOTICES.md', () => {
    const unlisted = bundledPackages
      .map(({ name }) => name)
      .filter((name) => !listedPackages.has(name))
    expect(unlisted).toEqual([])
  })
})

const allowedLicenses = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
])
