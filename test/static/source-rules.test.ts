// Static checks from docs/spec.md §11.1 over every script that ships in the
// extension (src/ and public/).
import { describe, expect, it } from 'vitest'
import {
  findNetworkApiUses,
  findStorageSyncUses,
  listShippedScripts,
  providerModuleDir,
  readRepoFile,
  type SourceFinding,
} from './scan-source'

const shippedScripts = listShippedScripts()

describe('shipped source', () => {
  it('includes the extension entry points', () => {
    expect(shippedScripts).toEqual(
      expect.arrayContaining([
        'src/background/index.ts',
        'src/popup/main.tsx',
        'src/app/main.tsx',
      ]),
    )
  })

  it('reaches the network only from the provider module', () => {
    const outsideProvider = shippedScripts.filter(
      (path) => !path.startsWith(providerModuleDir),
    )
    expect(violations(outsideProvider, findNetworkApiUses)).toEqual([])
  })

  it('never uses chrome.storage.sync', () => {
    expect(violations(shippedScripts, findStorageSyncUses)).toEqual([])
  })
})

function violations(
  paths: string[],
  find: (code: string, fileName: string) => SourceFinding[],
): string[] {
  return paths.flatMap((path) =>
    find(readRepoFile(path), path).map(
      (finding) => `${path}:${String(finding.line)} ${finding.text}`,
    ),
  )
}
