// Storage access levels (docs/spec.md §3.4): each item lives in one fixed
// area, storage.local is closed to injected scripts at service-worker start,
// and storage.session keeps its trusted-only default.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../src/core/settings'
import {
  deleteAllData,
  readLocal,
  readSetupState,
  removeLocal,
  storageAreas,
  writeLocal,
  type LocalKey,
} from '../../src/storage/store'
import { installFakeChrome } from '../support/fake-chrome'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

// A key-shaped value built at run time, so no committed literal looks like
// a real credential.
const fakeKey = ['sk', 'or', 'v1', 'x'.repeat(24)].join('-')

describe('storage areas', () => {
  it('keeps settings, keys, the CV, eligibility facts, and history in storage.local', () => {
    expect(storageAreas).toEqual({
      settings: 'local',
      apiKeys: 'local',
      cv: 'local',
      eligibility: 'local',
      history: 'local',
      analysis: 'session',
    })
  })

  it('writes keys to storage.local only', async () => {
    const { chrome, local, session } = installFakeChrome()
    await writeLocal('apiKeys', { openrouter: fakeKey })
    expect(local.get('apiKeys')).toEqual({ openrouter: fakeKey })
    expect(session.size).toBe(0)
    expect(chrome.storage.session.set).not.toHaveBeenCalled()
  })

  it('refuses to put the analysis in progress into storage.local', async () => {
    const { local } = installFakeChrome()
    const write = writeLocal as (key: string, value: unknown) => Promise<void>
    await expect(
      write('analysis', { description: 'raw text' }),
    ).rejects.toThrow('not stored in chrome.storage.local')
    await expect(readLocal('analysis' as LocalKey)).rejects.toThrow()
    expect(local.size).toBe(0)
  })

  it('reads back and removes an item', async () => {
    installFakeChrome({ eligibility: { currentLocation: 'Exampleton' } })
    expect(await readLocal('eligibility')).toEqual({
      currentLocation: 'Exampleton',
    })
    await removeLocal('eligibility')
    expect(await readLocal('eligibility')).toBeUndefined()
  })

  it('fills in default settings', async () => {
    installFakeChrome({
      settings: { route: 'typesafe', models: { typesafe: 'jev-x' } },
    })
    const state = await readSetupState()
    expect(state.settings).toEqual({
      ...defaultSettings,
      route: 'typesafe',
      models: { openrouter: 'typesafe/jev-1.13', typesafe: 'jev-x' },
    })
    expect(state.apiKeys).toEqual({})
    expect(state.cv).toBeUndefined()
  })

  it('deletes everything from both areas', async () => {
    const { local, session } = installFakeChrome({
      apiKeys: { openrouter: fakeKey },
    })
    session.set('analysis', {})
    await deleteAllData()
    expect(local.size).toBe(0)
    expect(session.size).toBe(0)
  })
})

describe('service worker start', () => {
  it('restricts storage.local to trusted contexts and leaves storage.session alone', async () => {
    const { chrome } = installFakeChrome()
    await import('../../src/background/index')
    expect(chrome.storage.local.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS',
    })
    expect(chrome.storage.session.setAccessLevel).not.toHaveBeenCalled()
  })

  it('opens setup in the full tab on install only', async () => {
    const { chrome } = installFakeChrome()
    await import('../../src/background/index')
    const [listener] = chrome.runtime.onInstalled.addListener.mock.calls[0] as [
      (details: { reason: string }) => void,
    ]
    listener({ reason: 'update' })
    expect(chrome.tabs.create).not.toHaveBeenCalled()
    listener({ reason: 'install' })
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/app.html',
    })
  })
})
