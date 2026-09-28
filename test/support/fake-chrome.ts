// An in-memory stand-in for the chrome.* APIs the extension pages and the
// service worker use. Stored values are cloned, as chrome.storage does.

import { vi } from 'vitest'

export function installFakeChrome(initialLocal: Record<string, unknown> = {}) {
  const local = new Map(Object.entries(structuredClone(initialLocal)))
  const session = new Map<string, unknown>()
  const fake = {
    storage: { local: storageArea(local), session: storageArea(session) },
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      getManifest: () => ({ version: '0.0.0' }),
      onInstalled: { addListener: vi.fn() },
    },
    tabs: { create: vi.fn(() => Promise.resolve({})) },
    permissions: { request: vi.fn(() => Promise.resolve(true)) },
  }
  vi.stubGlobal('chrome', fake)
  return { chrome: fake, local, session }
}

function storageArea(items: Map<string, unknown>) {
  return {
    get: vi.fn((keys?: string | string[]) => {
      const wanted =
        keys === undefined
          ? [...items.keys()]
          : Array.isArray(keys)
            ? keys
            : [keys]
      return Promise.resolve(
        Object.fromEntries(
          wanted
            .filter((key) => items.has(key))
            .map((key) => [key, structuredClone(items.get(key))]),
        ),
      )
    }),
    set: vi.fn((values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values))
        items.set(key, structuredClone(value))
      return Promise.resolve()
    }),
    remove: vi.fn((keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) items.delete(key)
      return Promise.resolve()
    }),
    clear: vi.fn(() => {
      items.clear()
      return Promise.resolve()
    }),
    setAccessLevel: vi.fn(() => Promise.resolve()),
  }
}
