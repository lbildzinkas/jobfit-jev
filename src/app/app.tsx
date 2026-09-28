import type { ReactNode } from 'react'
import { setupProgress } from '../core/settings'
import { Button, Notice } from '../ui/controls'
import { SettingsPage } from './settings/settings-page'
import { CvReview } from './setup/cv-review'
import { SetupWizard } from './setup/setup-wizard'
import { navigate, useHashRoute, useSetupState } from './use-setup-state'

export function App() {
  const { state, loadError, reload } = useSetupState()
  const route = useHashRoute()

  if (loadError !== undefined)
    return (
      <Page>
        <Notice tone="error">{loadError}</Notice>
      </Page>
    )
  if (state === undefined)
    return (
      <Page>
        <p className="text-slate-600">{content.loading}</p>
      </Page>
    )

  if (route === '/settings')
    return (
      <Page>
        <SettingsPage state={state} onChange={reload} />
      </Page>
    )
  if (route === '/review' && state.cv !== undefined) {
    const cv = state.cv
    return (
      <Page wide>
        <CvReview
          cv={cv}
          onConfirmed={async () => {
            await reload()
            navigate('/settings')
          }}
        />
      </Page>
    )
  }

  const progress = setupProgress(state)
  if (!progress.isComplete || !state.settings.eligibilityStepDone)
    return (
      <Page wide={progress.hasCv && progress.hasKey && !progress.isCvConfirmed}>
        <SetupWizard state={state} onChange={reload} />
      </Page>
    )

  return (
    <Page>
      <h2 className="text-xl font-semibold">{content.readyTitle}</h2>
      <p className="mt-2 text-slate-600">{content.ready}</p>
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => {
          navigate('/settings')
        }}
      >
        {content.openSettings}
      </Button>
    </Page>
  )
}

function Page({
  wide = false,
  children,
}: {
  wide?: boolean
  children: ReactNode
}) {
  return (
    <main
      className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-3xl'} p-8 text-slate-900`}
    >
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{content.title}</h1>
        <nav className="flex gap-4 text-sm">
          <a className="underline" href="#/">
            {content.home}
          </a>
          <a className="underline" href="#/settings">
            {content.settings}
          </a>
        </nav>
      </header>
      {children}
    </main>
  )
}

const content = {
  title: 'jobfit-jev',
  home: 'Setup',
  settings: 'Settings',
  loading: 'Loading…',
  readyTitle: 'Setup is complete',
  ready:
    'Your route, key, and confirmed CV are saved on this machine. Job analysis is not built yet; it will start from the toolbar popup on a LinkedIn job.',
  openSettings: 'Open settings',
}
