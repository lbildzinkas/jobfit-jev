import { describe, expect, it } from 'vitest'
import { findNetworkApiUses, findStorageSyncUses } from './scan-source'

describe('findNetworkApiUses', () => {
  it.each([
    ['a direct call', 'fetch(url)'],
    ['a global property', 'await globalThis.fetch(url)'],
    ['a computed global property', "self['fetch'](url)"],
    ['a destructured global', 'const { fetch: get } = globalThis'],
    ['XMLHttpRequest', 'new XMLHttpRequest()'],
    ['WebSocket', 'new WebSocket(url)'],
    ['EventSource', 'new EventSource(url)'],
  ])('flags %s', (_, code) => {
    expect(findNetworkApiUses(code, 'probe.ts')).not.toEqual([])
  })

  it('flags a call inside JSX', () => {
    const code = 'export const b = <button onClick={() => fetch(u)} />'
    expect(findNetworkApiUses(code, 'probe.tsx')).toEqual([
      { line: 1, text: 'fetch' },
    ])
  })

  it.each([
    ['a line comment', '// fetch the job\nconst x = 1'],
    ['a block comment', '/* XMLHttpRequest, WebSocket */ const x = 1'],
    ['a longer identifier', 'const fetchJob = 1; prefetch()'],
    ['prose in a string', "const label = 'fetch failed'"],
  ])('ignores %s', (_, code) => {
    expect(findNetworkApiUses(code, 'probe.ts')).toEqual([])
  })
})

describe('findStorageSyncUses', () => {
  it.each([
    ['a direct call', 'chrome.storage.sync.get()'],
    ['a computed member', "chrome.storage['sync'].set({})"],
    ['destructuring', 'const { sync } = chrome.storage'],
    ['an alias', 'const area = chrome.storage; area.sync.clear()'],
  ])('flags %s', (_, code) => {
    expect(findStorageSyncUses(code, 'probe.ts')).not.toEqual([])
  })

  it.each([
    ['local storage', 'chrome.storage.local.get()'],
    ['a comment', '// never chrome.storage.sync\nconst x = 1'],
    ['an area-name comparison', "if (areaName === 'sync') stop()"],
    ['a longer identifier', 'const isSyncing = true'],
  ])('ignores %s', (_, code) => {
    expect(findStorageSyncUses(code, 'probe.ts')).toEqual([])
  })
})
