import { useState } from 'react'
import { setupProgress, type SetupState } from '../../core/settings'
import { writeLocal } from '../../storage/store'
import { CvImport } from './cv-import'
import { CvReview } from './cv-review'
import { EligibilityForm } from './eligibility-form'
import { RouteKeyForm } from './route-key-form'

type Step = 1 | 2 | 3 | 4

export function SetupWizard({
  state,
  onChange,
}: {
  state: SetupState
  onChange: () => Promise<void>
}) {
  const progress = setupProgress(state)
  const firstOpen: Step = !progress.hasKey
    ? 1
    : !progress.hasCv
      ? 2
      : !progress.isCvConfirmed
        ? 3
        : 4
  const [chosen, setChosen] = useState<Step>()
  const step = chosen ?? firstOpen

  const done = async () => {
    setChosen(undefined)
    await onChange()
  }
  const isDone: Record<Step, boolean> = {
    1: progress.hasKey,
    2: progress.hasCv,
    3: progress.isCvConfirmed,
    4: state.settings.eligibilityStepDone,
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">{content.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{content.intro}</p>
      <ol className="mt-4 flex flex-wrap gap-2 text-sm">
        {stepTitles.map((title, index) => {
          const number = (index + 1) as Step
          const isReachable = number <= firstOpen || isDone[number]
          return (
            <li key={title}>
              <button
                type="button"
                disabled={!isReachable}
                aria-current={number === step ? 'step' : undefined}
                onClick={() => {
                  setChosen(number)
                }}
                className={`rounded-full border px-3 py-1 focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50 ${
                  number === step
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {number}. {title}
                {isDone[number] ? ` ${content.doneMark}` : ''}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="mt-6">
        {step === 1 && <RouteKeyForm state={state} onSaved={done} />}
        {step === 2 && <CvImport onImported={done} />}
        {step === 3 &&
          (state.cv === undefined ? (
            <CvImport onImported={done} />
          ) : (
            <CvReview cv={state.cv} onConfirmed={done} />
          ))}
        {step === 4 && (
          <EligibilityForm
            initial={state.eligibility}
            onSaved={async () => {
              await writeLocal('settings', {
                ...state.settings,
                eligibilityStepDone: true,
              })
              await done()
            }}
            allowSkip
          />
        )}
      </div>
    </div>
  )
}

const stepTitles = [
  'Model route and key',
  'CV import',
  'Parsed-CV confirmation',
  'Eligibility facts (optional)',
]

const content = {
  title: 'First-run setup',
  intro:
    'Steps 1 to 3 are needed before Analyze is enabled. Everything you enter stays in this browser’s local extension storage.',
  doneMark: '✓',
}
