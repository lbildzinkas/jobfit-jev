import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

export const repoRoot = resolve(import.meta.dirname, '../..')

// The only place allowed to reach the network (docs/spec.md §3.3).
export const providerModuleDir = 'src/background/provider/'

export interface SourceFinding {
  line: number
  text: string
}

export function listShippedScripts(): string[] {
  return shippedRoots.flatMap((root) =>
    readdirSync(resolve(repoRoot, root), { recursive: true, encoding: 'utf8' })
      .map((path) => `${root}/${path.split('\\').join('/')}`)
      .filter((path) => scriptExtension.test(path)),
  )
}

export function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

export function findNetworkApiUses(
  code: string,
  fileName: string,
): SourceFinding[] {
  return findNodes(code, fileName, (node) => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
      return networkApis.has(node.text)
    return false
  })
}

// Any `sync` member is refused, not only `chrome.storage.sync`, so aliases
// such as `const area = chrome.storage; area.sync` are caught too.
export function findStorageSyncUses(
  code: string,
  fileName: string,
): SourceFinding[] {
  return findNodes(code, fileName, (node) => {
    if (ts.isPropertyAccessExpression(node)) return node.name.text === 'sync'
    if (ts.isElementAccessExpression(node))
      return (
        ts.isStringLiteralLike(node.argumentExpression) &&
        node.argumentExpression.text === 'sync'
      )
    if (ts.isBindingElement(node))
      return (node.propertyName ?? node.name).getText() === 'sync'
    return false
  })
}

// Web storage and IndexedDB are never used (docs/spec.md §3.4): everything
// the extension keeps goes through chrome.storage.
export function findWebStorageUses(
  code: string,
  fileName: string,
): SourceFinding[] {
  return findNodes(code, fileName, (node) => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
      return webStorageApis.has(node.text)
    return false
  })
}

function findNodes(
  code: string,
  fileName: string,
  isMatch: (node: ts.Node) => boolean,
): SourceFinding[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
  )
  const findings: SourceFinding[] = []
  const visit = (node: ts.Node) => {
    if (isMatch(node))
      findings.push({
        line:
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        text: node.getText(),
      })
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return findings
}

const shippedRoots = ['src', 'public']
const scriptExtension = /\.[cm]?[jt]sx?$/
const webStorageApis = new Set(['localStorage', 'sessionStorage', 'indexedDB'])
const networkApis = new Set([
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
])
