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

const bundledPackages = Object.entries(lockfile.packages)
  .filter(([path, entry]) => path !== '' && entry.dev !== true)
  .map(([path, entry]) => ({
    name: path.slice(
      path.lastIndexOf('node_modules/') + 'node_modules/'.length,
    ),
    license: entry.license,
  }))

describe('bundled packages', () => {
  it('include the UI runtime', () => {
    expect(bundledPackages.map(({ name }) => name)).toContain('react')
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
