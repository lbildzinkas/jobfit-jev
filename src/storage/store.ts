// Where each piece of data is stored (docs/spec.md §3.4). Every item has one
// fixed area: settings, keys, the CV, eligibility facts, and history in
// chrome.storage.local, restricted to trusted extension contexts; the
// analysis in progress in chrome.storage.session. Never storage.sync, web
// storage, or IndexedDB.

import {
  defaultSettings,
  type ApiKeys,
  type EligibilityFacts,
  type Settings,
  type SetupState,
  type StoredCv,
} from '../core/settings'

export interface LocalItems {
  settings: Settings
  apiKeys: ApiKeys
  cv: StoredCv
  eligibility: EligibilityFacts
}

export type LocalKey = keyof LocalItems

/** The storage area of every item the extension keeps. */
export const storageAreas = {
  settings: 'local',
  apiKeys: 'local',
  cv: 'local',
  eligibility: 'local',
  history: 'local',
  analysis: 'session',
} as const

const localKeys = Object.entries(storageAreas)
  .filter(([, area]) => area === 'local')
  .map(([key]) => key)

/**
 * Called at service-worker start: only extension pages and the service
 * worker may read storage.local, never a script injected into a page.
 * storage.session keeps its default, which is already trusted-only.
 */
export function restrictLocalStorage(): Promise<void> {
  return chrome.storage.local.setAccessLevel({
    accessLevel: 'TRUSTED_CONTEXTS',
  })
}

export async function readLocal<K extends LocalKey>(
  key: K,
): Promise<LocalItems[K] | undefined> {
  assertLocalKey(key)
  const items = await chrome.storage.local.get(key)
  return items[key] as LocalItems[K] | undefined
}

export async function writeLocal<K extends LocalKey>(
  key: K,
  value: LocalItems[K],
): Promise<void> {
  assertLocalKey(key)
  await chrome.storage.local.set({ [key]: value })
}

export async function removeLocal(key: LocalKey): Promise<void> {
  assertLocalKey(key)
  await chrome.storage.local.remove(key)
}

export async function readSetupState(): Promise<SetupState> {
  const [settings, apiKeys, cv, eligibility] = await Promise.all([
    readLocal('settings'),
    readLocal('apiKeys'),
    readLocal('cv'),
    readLocal('eligibility'),
  ])
  return {
    settings: {
      ...defaultSettings,
      ...settings,
      models: { ...defaultSettings.models, ...settings?.models },
    },
    apiKeys: apiKeys ?? {},
    ...(cv === undefined ? {} : { cv }),
    ...(eligibility === undefined ? {} : { eligibility }),
  }
}

/** "Delete all extension data" (docs/spec.md §4.2). */
export async function deleteAllData(): Promise<void> {
  await Promise.all([
    chrome.storage.local.clear(),
    chrome.storage.session.clear(),
  ])
}

function assertLocalKey(key: string): void {
  if (!localKeys.includes(key))
    throw new Error(`"${key}" is not stored in chrome.storage.local`)
}
