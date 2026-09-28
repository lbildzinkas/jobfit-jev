import { useState } from 'react'
import { setupProgress, type SetupState } from '../../core/settings'
import { deleteAllData, removeLocal, writeLocal } from '../../storage/store'
import { Button, Notice, Section } from '../../ui/controls'
import { CvImport } from '../setup/cv-import'
import { EligibilityForm } from '../setup/eligibility-form'
import { RouteKeyForm } from '../setup/route-key-form'
import { navigate } from '../use-setup-state'

// Settings (docs/spec.md §4.2).
export function SettingsPage({
  state,
  onChange,
}: {
  state: SetupState
  onChange: () => Promise<void>
}) {
  const progress = setupProgress(state)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{content.title}</h2>
      {!progress.isComplete && (
        <Notice tone="warning">
          {content.incomplete}{' '}
          <a className="underline" href="#/">
            {content.finishSetup}
          </a>
        </Notice>
      )}

      <Section title={content.routeTitle}>
        <RouteKeyForm state={state} onSaved={onChange} />
      </Section>

      <Section title={content.privacyTitle}>
        <p>{content.privacy}</p>
        <code className="block rounded bg-slate-100 px-2 py-1">
          {content.privacyValue}
        </code>
        <p className="text-slate-600">{content.privacyReadOnly}</p>
      </Section>

      <CvSettings state={state} onChange={onChange} />

      <Section title={content.eligibilityTitle}>
        <EligibilityForm initial={state.eligibility} onSaved={onChange} />
      </Section>

      <Section title={content.historyTitle}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.settings.historyEnabled}
            onChange={(event) => {
              void writeLocal('settings', {
                ...state.settings,
                historyEnabled: event.target.checked,
              }).then(onChange)
            }}
          />
          {content.historyToggle}
        </label>
        <p className="text-slate-600">{content.historyEmpty}</p>
      </Section>

      <Section title={content.boundaryTitle}>
        <DataBoundaryMap />
      </Section>

      <DeleteAll onDeleted={onChange} />

      <Section title={content.aboutTitle}>
        <p>
          {content.version} {chrome.runtime.getManifest().version}
        </p>
        <ul className="list-disc pl-5">
          {aboutLinks.map(([label, href]) => (
            <li key={href}>
              <a
                className="underline"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function CvSettings({
  state,
  onChange,
}: {
  state: SetupState
  onChange: () => Promise<void>
}) {
  const [isReplacing, setIsReplacing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const { cv } = state

  return (
    <Section title={content.cvTitle}>
      {cv === undefined ? (
        <p>{content.noCv}</p>
      ) : (
        <>
          <p>
            {cv.fileName} · {content.imported}{' '}
            {new Date(cv.importedAt).toLocaleDateString()} ·{' '}
            {cv.confirmedAt === undefined
              ? content.notConfirmed
              : content.confirmed}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                navigate('/review')
              }}
            >
              {content.reopen}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsReplacing(!isReplacing)
              }}
            >
              {content.replace}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirmingDelete(true)
              }}
            >
              {content.deleteCv}
            </Button>
          </div>
          {isConfirmingDelete && (
            <div className="flex flex-wrap items-center gap-2" role="group">
              <span>{content.confirmDeleteCv}</span>
              <Button
                variant="danger"
                onClick={() => {
                  void removeLocal('cv').then(() => {
                    setIsConfirmingDelete(false)
                    return onChange()
                  })
                }}
              >
                {content.deleteCvConfirmed}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsConfirmingDelete(false)
                }}
              >
                {content.cancel}
              </Button>
            </div>
          )}
        </>
      )}
      {(cv === undefined || isReplacing) && (
        <CvImport
          onImported={async () => {
            setIsReplacing(false)
            await onChange()
            navigate('/review')
          }}
        />
      )}
    </Section>
  )
}

function DataBoundaryMap() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {boundary.map(([heading]) => (
              <th
                key={heading}
                className="border border-slate-200 bg-slate-50 p-2 align-top"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {boundary.map(([heading, items]) => (
              <td
                key={heading}
                className="border border-slate-200 p-2 align-top"
              >
                <ul className="list-disc pl-4">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DeleteAll({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [isConfirming, setIsConfirming] = useState(false)
  return (
    <Section title={content.deleteAllTitle}>
      <p>{content.deleteAllHint}</p>
      {isConfirming ? (
        <div className="flex flex-wrap items-center gap-2" role="group">
          <span>{content.confirmDeleteAll}</span>
          <Button
            variant="danger"
            onClick={() => {
              void deleteAllData().then(() => {
                setIsConfirming(false)
                navigate('/')
                return onDeleted()
              })
            }}
          >
            {content.deleteAllConfirmed}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setIsConfirming(false)
            }}
          >
            {content.cancel}
          </Button>
        </div>
      ) : (
        <Button
          variant="danger"
          onClick={() => {
            setIsConfirming(true)
          }}
        >
          {content.deleteAll}
        </Button>
      )}
    </Section>
  )
}

// The data-boundary map (docs/spec.md §2.3).
const boundary: [string, string[]][] = [
  [
    'Never leaves this machine',
    [
      'CV PDF and parsed CV, including the header',
      'API keys (except as the Authorization header to your route)',
      'Raw posting text (memory only)',
      'Eligibility facts',
      'History',
    ],
  ],
  [
    'Stripped in code before sending',
    ['Name, email, phone, address, links, photo', 'Protected attributes'],
  ],
  [
    'Sent to Jev (selected route, your key)',
    [
      'Stripped CV body (experience, skills, education, summary)',
      'Posting sections and requirements',
      'Typed questions',
    ],
  ],
]

const repository = 'https://github.com/lbildzinkas/jobfit-jev/blob/master'
const aboutLinks: [string, string][] = [
  ['Specification', `${repository}/docs/spec.md`],
  ['Jev guide', `${repository}/docs/jev-guide.md`],
  ['Third-party notices', `${repository}/THIRD_PARTY_NOTICES.md`],
]

const content = {
  title: 'Settings',
  incomplete: 'Setup is not complete, so Analyze stays disabled.',
  finishSetup: 'Finish setup',
  routeTitle: 'Route and key',
  privacyTitle: 'Privacy routing (OpenRouter)',
  privacy:
    'Each OpenRouter request will ask for zero data retention, no data collection, and no fallback providers:',
  privacyValue:
    'provider: { zdr: true, data_collection: "deny", allow_fallbacks: false }',
  privacyReadOnly:
    'Shown read-only until a live check confirms OpenRouter accepts it on this endpoint.',
  cvTitle: 'Canonical CV',
  noCv: 'No CV imported yet.',
  imported: 'imported',
  confirmed: 'confirmed',
  notConfirmed: 'not confirmed yet',
  reopen: 'Re-open parsed-CV confirmation',
  replace: 'Replace',
  deleteCv: 'Delete',
  confirmDeleteCv:
    'Delete the stored CV and your corrections? Analyze stays disabled until you import one again.',
  deleteCvConfirmed: 'Delete CV',
  cancel: 'Cancel',
  eligibilityTitle: 'Eligibility facts',
  historyTitle: 'History',
  historyToggle: 'Keep a history of assessments on this machine',
  historyEmpty:
    'No assessments yet. Per-item delete and delete-all appear here once assessments exist.',
  boundaryTitle: 'What leaves this machine',
  deleteAllTitle: 'Delete all extension data',
  deleteAllHint:
    'Clears local and session extension storage: keys, CV, corrections, eligibility facts, settings, and any analysis in progress.',
  deleteAll: 'Delete all extension data',
  confirmDeleteAll:
    'Delete everything this extension stores? This cannot be undone.',
  deleteAllConfirmed: 'Delete everything',
  aboutTitle: 'About',
  version: 'Version',
}
