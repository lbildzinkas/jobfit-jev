// Setup and settings data (docs/spec.md §4.1–§4.2) and the rule for when
// setup is complete. Plain data only; storage lives in src/storage/.

import type { CvCorrections, CvLine, StrippedCv } from './cv/types'

export type Route = 'openrouter' | 'typesafe'

export const routes: Record<
  Route,
  { label: string; defaultModel: string; host: string }
> = {
  openrouter: {
    label: 'OpenRouter (default)',
    defaultModel: 'typesafe/jev-1.13',
    host: 'openrouter.ai',
  },
  typesafe: {
    label: 'TypeSafe direct',
    defaultModel: 'jev-1.13.0',
    host: 'api.typesafe.ai',
  },
}

export interface Settings {
  route: Route
  /** Model ID per route, so switching routes keeps each pinned model. */
  models: Record<Route, string>
  historyEnabled: boolean
  /** Whether the owner finished or skipped the eligibility step. */
  eligibilityStepDone: boolean
}

export const defaultSettings: Settings = {
  route: 'openrouter',
  models: {
    openrouter: routes.openrouter.defaultModel,
    typesafe: routes.typesafe.defaultModel,
  },
  historyEnabled: false,
  eligibilityStepDone: false,
}

/** One key per route, so switching routes does not lose the other key. */
export type ApiKeys = Partial<Record<Route, string>>

export interface StoredCv {
  fileName: string
  source: 'pdf' | 'paste'
  /** The PDF itself, base64-encoded; absent for pasted text. */
  pdfBase64?: string
  importedAt: string
  lines: CvLine[]
  hasImageOnFirstPage: boolean
  corrections: CvCorrections
  /** Set when the owner confirms the parsed CV; cleared by a new import. */
  confirmedAt?: string
  /** Derived from `lines` and `corrections` whenever either changes. */
  stripped: StrippedCv
}

export type Workplace = 'remote' | 'hybrid' | 'on-site'

export interface EligibilityFacts {
  workAuthorization: string[]
  currentLocation: string
  relocation: '' | 'yes' | 'no' | 'depends'
  workplace: Workplace[]
  salaryFloor: string
  clearance: string
}

export const emptyEligibility: EligibilityFacts = {
  workAuthorization: [],
  currentLocation: '',
  relocation: '',
  workplace: [],
  salaryFloor: '',
  clearance: '',
}

export interface SetupState {
  settings: Settings
  apiKeys: ApiKeys
  cv?: StoredCv
  eligibility?: EligibilityFacts
}

export interface SetupProgress {
  hasKey: boolean
  hasCv: boolean
  isCvConfirmed: boolean
  /** Steps 1–3 done: Analyze may be enabled (docs/spec.md §4.1). */
  isComplete: boolean
}

export function setupProgress(state: SetupState): SetupProgress {
  const hasKey = (state.apiKeys[state.settings.route] ?? '').trim() !== ''
  const hasCv = state.cv !== undefined
  const isCvConfirmed = state.cv?.confirmedAt !== undefined
  return { hasKey, hasCv, isCvConfirmed, isComplete: hasKey && isCvConfirmed }
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length)
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`
}
