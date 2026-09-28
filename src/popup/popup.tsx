import { useEffect, useState } from 'react'
import { routes, setupProgress, type SetupState } from '../core/settings'
import { readSetupState } from '../storage/store'
import { Button } from '../ui/controls'

// Popup states for this milestone (docs/spec.md §10.1): setup needed, or
// ready with the route and model. Analyze arrives with the assessment.
export function Popup() {
  const [state, setState] = useState<SetupState>()
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    readSetupState().then(setState, () => {
      setLoadError(true)
    })
  }, [])

  const progress = state === undefined ? undefined : setupProgress(state)

  return (
    <main className="w-[400px] p-4 text-sm text-slate-900">
      <h1 className="text-base font-semibold">{content.title}</h1>
      {loadError && <p className="mt-1 text-red-800">{content.loadError}</p>}
      {state !== undefined && progress !== undefined && (
        <>
          {progress.isComplete ? (
            <div className="mt-2 space-y-2">
              <p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {routes[state.settings.route].label} ·{' '}
                  {state.settings.models[state.settings.route]}
                </span>
              </p>
              <Button disabled>{content.analyze}</Button>
              <p className="text-slate-600">{content.analyzeLater}</p>
            </div>
          ) : (
            <p className="mt-1 text-slate-600">{content.setupNeeded}</p>
          )}
          <Button
            variant={progress.isComplete ? 'secondary' : 'primary'}
            className="mt-4"
            onClick={() => {
              openFullTab(progress.isComplete ? '#/settings' : '')
            }}
          >
            {progress.isComplete ? content.openSettings : content.finishSetup}
          </Button>
        </>
      )}
    </main>
  )
}

function openFullTab(hash: string) {
  void chrome.tabs.create({ url: chrome.runtime.getURL(`app.html${hash}`) })
}

const content = {
  title: 'jobfit-jev',
  loadError: 'Could not read the extension storage.',
  setupNeeded:
    'Setup needed: choose a model route, add your key, and import and confirm your CV.',
  finishSetup: 'Finish setup',
  analyze: 'Analyze',
  analyzeLater: 'Job analysis is not built yet.',
  openSettings: 'Open settings',
}
