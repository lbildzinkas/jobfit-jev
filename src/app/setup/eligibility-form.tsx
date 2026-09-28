import { useState } from 'react'
import {
  emptyEligibility,
  type EligibilityFacts,
  type Workplace,
} from '../../core/settings'
import { writeLocal } from '../../storage/store'
import { Button, Notice, inputClass } from '../../ui/controls'

export function EligibilityForm({
  initial,
  onSaved,
  allowSkip = false,
}: {
  initial?: EligibilityFacts
  onSaved: () => Promise<void>
  allowSkip?: boolean
}) {
  const [facts, setFacts] = useState(initial ?? emptyEligibility)
  const [authorization, setAuthorization] = useState(
    facts.workAuthorization.join(', '),
  )
  const [error, setError] = useState<string>()

  const save = async () => {
    setError(undefined)
    try {
      await writeLocal('eligibility', {
        ...facts,
        workAuthorization: authorization
          .split(',')
          .map((place) => place.trim())
          .filter((place) => place !== ''),
      })
      await onSaved()
    } catch {
      setError(content.saveFailed)
    }
  }

  const toggleWorkplace = (option: Workplace) => {
    setFacts({
      ...facts,
      workplace: facts.workplace.includes(option)
        ? facts.workplace.filter((value) => value !== option)
        : [...facts.workplace, option],
    })
  }

  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <p className="text-slate-600">{content.intro}</p>
      <TextField
        id="work-authorization"
        label={content.authorization}
        value={authorization}
        onChange={setAuthorization}
      />
      <TextField
        id="current-location"
        label={content.location}
        value={facts.currentLocation}
        onChange={(currentLocation) => {
          setFacts({ ...facts, currentLocation })
        }}
      />
      <div>
        <label className="block font-medium" htmlFor="relocation">
          {content.relocation}
        </label>
        <select
          id="relocation"
          className={`${inputClass} mt-1`}
          value={facts.relocation}
          onChange={(event) => {
            setFacts({
              ...facts,
              relocation: event.target.value as EligibilityFacts['relocation'],
            })
          }}
        >
          {relocationOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend className="font-medium">{content.workplace}</legend>
        <div className="mt-1 flex gap-4">
          {workplaceOptions.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={facts.workplace.includes(value)}
                onChange={() => {
                  toggleWorkplace(value)
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        id="salary-floor"
        label={content.salary}
        value={facts.salaryFloor}
        onChange={(salaryFloor) => {
          setFacts({ ...facts, salaryFloor })
        }}
      />
      <TextField
        id="clearance"
        label={content.clearance}
        value={facts.clearance}
        onChange={(clearance) => {
          setFacts({ ...facts, clearance })
        }}
      />
      {error !== undefined && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit">{content.save}</Button>
        {allowSkip && (
          <Button variant="secondary" onClick={() => void onSaved()}>
            {content.skip}
          </Button>
        )}
      </div>
    </form>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="block font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`${inputClass} mt-1`}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

const relocationOptions: [EligibilityFacts['relocation'], string][] = [
  ['', 'Not stated'],
  ['yes', 'Yes'],
  ['no', 'No'],
  ['depends', 'Depends'],
]

const workplaceOptions: [Workplace, string][] = [
  ['remote', 'Remote'],
  ['hybrid', 'Hybrid'],
  ['on-site', 'On-site'],
]

const content = {
  intro:
    'Optional. These facts are compared in code with a posting’s eligibility requirements and are never sent to Jev.',
  authorization: 'Work authorization (countries or regions, comma-separated)',
  location: 'Current location',
  relocation: 'Open to relocation',
  workplace: 'Workplace preference',
  salary: 'Salary floor (optional)',
  clearance: 'Security clearance (optional)',
  save: 'Save',
  skip: 'Skip for now',
  saveFailed: 'Could not save. Try again.',
}
