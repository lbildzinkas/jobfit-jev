import { useState } from 'react'
import {
  maskKey,
  routes,
  type ApiKeys,
  type Route,
  type SetupState,
} from '../../core/settings'
import { Button, Notice, inputClass } from '../../ui/controls'
import { writeLocal } from '../../storage/store'

export function RouteKeyForm({
  state,
  onSaved,
}: {
  state: SetupState
  onSaved: () => Promise<void>
}) {
  const [route, setRoute] = useState<Route>(state.settings.route)
  const [models, setModels] = useState(state.settings.models)
  const [keyDraft, setKeyDraft] = useState('')
  const [isEditingKey, setIsEditingKey] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const storedKey = state.apiKeys[route] ?? ''
  const showKeyInput = storedKey === '' || isEditingKey
  const model = models[route]

  const save = async () => {
    setError(undefined)
    const key = keyDraft.trim()
    if (storedKey === '' && key === '') {
      setError(content.keyRequired)
      return
    }
    setIsSaving(true)
    try {
      // TypeSafe direct needs its optional host permission (docs/spec.md
      // §3.2); asking first keeps the request inside the click.
      if (route === 'typesafe') {
        const isGranted = await chrome.permissions.request({
          origins: [typesafeOrigin],
        })
        if (!isGranted) {
          setError(content.permissionDenied)
          return
        }
      }
      await writeLocal('settings', {
        ...state.settings,
        route,
        models: {
          ...models,
          [route]: model.trim() || routes[route].defaultModel,
        },
      })
      if (key !== '')
        await writeLocal('apiKeys', { ...state.apiKeys, [route]: key })
      setKeyDraft('')
      setIsEditingKey(false)
      await onSaved()
    } catch {
      setError(content.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const removeKey = async () => {
    const remaining: ApiKeys = Object.fromEntries(
      Object.entries(state.apiKeys).filter(([name]) => name !== route),
    )
    await writeLocal('apiKeys', remaining)
    setIsConfirmingRemove(false)
    await onSaved()
  }

  return (
    <form
      className="space-y-5 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <fieldset>
        <legend className="font-medium">{content.routeLegend}</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(Object.keys(routes) as Route[]).map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="route"
                value={option}
                checked={route === option}
                onChange={() => {
                  setRoute(option)
                  setIsEditingKey(false)
                  setIsRevealed(false)
                  setIsConfirmingRemove(false)
                }}
              />
              {routes[option].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="font-medium">{content.keyLabel(routes[route].label)}</p>
        {showKeyInput ? (
          <div className="mt-2 flex gap-2">
            <label className="sr-only" htmlFor="api-key">
              {content.keyLabel(routes[route].label)}
            </label>
            <input
              id="api-key"
              className={inputClass}
              type={isRevealed ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={keyDraft}
              onChange={(event) => {
                setKeyDraft(event.target.value)
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setIsRevealed(!isRevealed)
              }}
            >
              {isRevealed ? content.hide : content.reveal}
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code
              className="rounded bg-slate-100 px-2 py-1"
              data-testid="stored-key"
            >
              {isRevealed ? storedKey : maskKey(storedKey)}
            </code>
            <Button
              variant="secondary"
              onClick={() => {
                setIsRevealed(!isRevealed)
              }}
            >
              {isRevealed ? content.hide : content.reveal}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditingKey(true)
                setIsRevealed(false)
              }}
            >
              {content.replace}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirmingRemove(true)
              }}
            >
              {content.remove}
            </Button>
          </div>
        )}
        {isConfirmingRemove && (
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group">
            <span>{content.confirmRemove(routes[route].label)}</span>
            <Button variant="danger" onClick={() => void removeKey()}>
              {content.removeConfirmed}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirmingRemove(false)
              }}
            >
              {content.cancel}
            </Button>
          </div>
        )}
        <p className="mt-2 text-slate-600">{content.keyCopy}</p>
        {route === 'openrouter' && (
          <p className="mt-1 text-slate-600">{content.dedicatedKey}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Button variant="secondary" disabled>
            {content.testKey}
          </Button>
          <span className="text-slate-500">{content.testKeyLater}</span>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer font-medium">
          {content.advanced}
        </summary>
        <div className="mt-2 space-y-2">
          <label className="block" htmlFor="model-id">
            {content.modelLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="model-id"
              className={inputClass}
              value={model}
              spellCheck={false}
              onChange={(event) => {
                setModels({ ...models, [route]: event.target.value })
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setModels({ ...models, [route]: routes[route].defaultModel })
              }}
            >
              {content.resetModel}
            </Button>
          </div>
          <Notice tone="warning">{content.modelWarning}</Notice>
        </div>
      </details>

      {error !== undefined && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={isSaving}>
        {content.save}
      </Button>
    </form>
  )
}

export const typesafeOrigin = 'https://api.typesafe.ai/*'

const content = {
  routeLegend: 'Model route',
  keyLabel: (route: string) => `API key for ${route}`,
  keyRequired: 'Enter your API key for this route.',
  permissionDenied:
    'TypeSafe direct needs permission to reach api.typesafe.ai. The route was not changed.',
  saveFailed: 'Could not save. Try again.',
  reveal: 'Reveal',
  hide: 'Hide',
  replace: 'Replace',
  remove: 'Remove',
  confirmRemove: (route: string) =>
    `Remove the key for ${route}? Analyze stays disabled until a key exists.`,
  removeConfirmed: 'Remove key',
  cancel: 'Cancel',
  keyCopy:
    'Your key is stored only in this browser’s local extension storage, never synced, and sent only to the route you pick.',
  dedicatedKey:
    'Tip: create a dedicated OpenRouter key with a per-key credit limit for this extension.',
  testKey: 'Test key',
  testKeyLater: 'Key testing arrives with the Jev client; nothing is sent yet.',
  advanced: 'Advanced',
  modelLabel: 'Model ID',
  resetModel: 'Reset to default',
  modelWarning:
    'Thresholds are tuned per model version. Change the pinned model only if you know why.',
  save: 'Save and continue',
}
