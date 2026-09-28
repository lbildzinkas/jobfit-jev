import { useMemo, useState, type ReactNode } from 'react'
import { protectedCategoryLabels } from '../../core/cv/protected'
import { confirmStoredCv, parseStoredCv } from '../../core/cv/stored'
import type {
  CvCorrections,
  CvLine,
  IdLine,
  LineStatus,
  ParsedCv,
  PiiSpan,
  SectionKind,
} from '../../core/cv/types'
import type { StoredCv } from '../../core/settings'
import { writeLocal } from '../../storage/store'
import { Button, Notice, inputClass } from '../../ui/controls'

// The parsed-CV confirmation (docs/spec.md §4.1 step 3): the header to strip
// beside the body to send, every detected personal detail highlighted, the
// withheld lines and why, and the owner's corrections.
export function CvReview({
  cv,
  onConfirmed,
}: {
  cv: StoredCv
  onConfirmed: () => Promise<void>
}) {
  const [corrections, setCorrections] = useState(cv.corrections)
  const [error, setError] = useState<string>()
  const parsed = useMemo(
    () => parseStoredCv(cv, corrections),
    [cv, corrections],
  )

  const update = (change: Partial<CvCorrections>) => {
    setCorrections({ ...corrections, ...change })
  }
  const toggle = (list: number[], index: number) =>
    list.includes(index)
      ? list.filter((value) => value !== index)
      : [...list, index]

  const confirm = async () => {
    setError(undefined)
    try {
      await writeLocal('cv', confirmStoredCv(cv, corrections, new Date()))
      await onConfirmed()
    } catch {
      setError(content.saveFailed)
    }
  }

  const actions: LineActions = {
    setHeaderEnd: (headerEnd) => {
      update({ headerEnd })
    },
    togglePrivate: (index) => {
      update({ privateLines: toggle(corrections.privateLines, index) })
    },
    toggleReleased: (index) => {
      update({ releasedLines: toggle(corrections.releasedLines, index) })
    },
    toggleHeading: (index, isHeading) => {
      if (isHeading)
        update({
          removedHeadings: [...corrections.removedHeadings, index],
          addedHeadings: corrections.addedHeadings.filter(
            (value) => value !== index,
          ),
        })
      else
        update({
          addedHeadings: [...corrections.addedHeadings, index],
          removedHeadings: corrections.removedHeadings.filter(
            (value) => value !== index,
          ),
        })
    },
    setSectionKind: (start, kind) => {
      update({ sectionKinds: { ...corrections.sectionKinds, [start]: kind } })
    },
    releaseSpan: (text) => {
      update({ releasedStrings: [...corrections.releasedStrings, text] })
    },
  }

  const withheld = parsed.statuses.flatMap((status, index) =>
    status.kind === 'withheld' ? [{ index, status }] : [],
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-xl font-semibold">{content.title}</h2>
        <p className="mt-1 text-slate-600">{content.intro(cv.fileName)}</p>
      </div>

      {parsed.noHeadingFound && corrections.headerEnd === undefined && (
        <Notice tone="warning">{content.noHeading}</Notice>
      )}
      {cv.hasImageOnFirstPage && <Notice>{content.photo}</Notice>}

      <OwnerTerms corrections={corrections} update={update} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="header-title"
          className="rounded-lg border border-red-200 bg-red-50/40 p-4"
        >
          <h3 id="header-title" className="font-semibold">
            {content.headerTitle}
          </h3>
          <p className="mt-1 text-slate-600">{content.headerHint}</p>
          <ol className="mt-3 space-y-1">
            {parsed.lines.slice(0, parsed.headerEnd).map((line) => (
              <HeaderLine
                key={line.index}
                line={line}
                status={parsed.statuses[line.index]}
                onBodyStartsHere={() => {
                  actions.setHeaderEnd(line.index)
                }}
              />
            ))}
          </ol>
          {parsed.headerEnd === 0 && (
            <p className="text-slate-500">{content.emptyHeader}</p>
          )}
        </section>

        <section
          aria-labelledby="body-title"
          className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
        >
          <h3 id="body-title" className="font-semibold">
            {content.bodyTitle}
          </h3>
          <p className="mt-1 text-slate-600">{content.bodyHint}</p>
          <BodyLines parsed={parsed} actions={actions} />
        </section>
      </div>

      <section aria-labelledby="withheld-title">
        <h3 id="withheld-title" className="font-semibold">
          {content.withheldTitle}
        </h3>
        {withheld.length === 0 ? (
          <p className="mt-1 text-slate-600">{content.noneWithheld}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {withheld.map(({ index, status }) => (
              <li key={index}>
                <span className="line-through">
                  {parsed.lines[index]?.text}
                </span>{' '}
                <span className="text-slate-600">
                  — {protectedCategoryLabels[status.category]}
                  {status.match === '' ? '' : ` (matched “${status.match}”)`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StrippedPreview parsed={parsed} />

      {error !== undefined && <Notice tone="error">{error}</Notice>}
      <Button onClick={() => void confirm()}>{content.confirm}</Button>
    </div>
  )
}

interface LineActions {
  setHeaderEnd: (headerEnd: number) => void
  togglePrivate: (index: number) => void
  toggleReleased: (index: number) => void
  toggleHeading: (index: number, isHeading: boolean) => void
  setSectionKind: (start: number, kind: SectionKind) => void
  releaseSpan: (text: string) => void
}

function OwnerTerms({
  corrections,
  update,
}: {
  corrections: CvCorrections
  update: (change: Partial<CvCorrections>) => void
}) {
  const [address, setAddress] = useState('')
  const [privateText, setPrivateText] = useState('')

  return (
    <section
      aria-labelledby="terms-title"
      className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-3"
    >
      <h3 id="terms-title" className="sr-only">
        {content.termsTitle}
      </h3>
      <div>
        <label className="block font-medium" htmlFor="cv-name">
          {content.nameLabel}
        </label>
        <input
          id="cv-name"
          className={`${inputClass} mt-1`}
          value={corrections.name}
          onChange={(event) => {
            update({ name: event.target.value })
          }}
        />
        <p className="mt-1 text-slate-500">{content.nameHint}</p>
      </div>
      <TermList
        id="cv-address"
        label={content.addressLabel}
        values={corrections.addresses}
        draft={address}
        setDraft={setAddress}
        onChange={(addresses) => {
          update({ addresses })
        }}
      />
      <TermList
        id="cv-private"
        label={content.privateLabel}
        values={corrections.privateStrings}
        draft={privateText}
        setDraft={setPrivateText}
        onChange={(privateStrings) => {
          update({ privateStrings })
        }}
      />
      {corrections.releasedStrings.length > 0 && (
        <div className="md:col-span-3">
          <p className="font-medium">{content.releasedLabel}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {corrections.releasedStrings.map((text) => (
              <li key={text}>
                <Button
                  variant="secondary"
                  aria-label={`${content.strip} ${text}`}
                  onClick={() => {
                    update({
                      releasedStrings: corrections.releasedStrings.filter(
                        (value) => value !== text,
                      ),
                    })
                  }}
                >
                  {text} ✕
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function TermList({
  id,
  label,
  values,
  draft,
  setDraft,
  onChange,
}: {
  id: string
  label: string
  values: string[]
  draft: string
  setDraft: (value: string) => void
  onChange: (values: string[]) => void
}) {
  const add = () => {
    const value = draft.trim()
    if (value === '' || values.includes(value)) return
    onChange([...values, value])
    setDraft('')
  }
  return (
    <div>
      <label className="block font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          className={inputClass}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
        />
        <Button variant="secondary" onClick={add}>
          {content.add}
        </Button>
      </div>
      <ul className="mt-2 space-y-1">
        {values.map((value) => (
          <li key={value} className="flex items-center justify-between gap-2">
            <span>{value}</span>
            <Button
              variant="link"
              aria-label={`${content.removeTerm} ${value}`}
              onClick={() => {
                onChange(values.filter((item) => item !== value))
              }}
            >
              {content.removeTerm}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HeaderLine({
  line,
  status,
  onBodyStartsHere,
}: {
  line: CvLine
  status: LineStatus | undefined
  onBodyStartsHere: () => void
}) {
  const pii = status !== undefined && 'pii' in status ? status.pii : []
  return (
    <li className="group flex items-start justify-between gap-2">
      <span>
        <Highlighted text={line.text} spans={pii} />
      </span>
      <Button
        variant="link"
        className="shrink-0 text-xs"
        onClick={onBodyStartsHere}
      >
        {content.bodyStartsHere}
      </Button>
    </li>
  )
}

function BodyLines({
  parsed,
  actions,
}: {
  parsed: ParsedCv
  actions: LineActions
}) {
  return (
    <div className="mt-3 space-y-4">
      {parsed.sections.map((section) => (
        <div key={section.start}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {section.heading === '' ? content.untitled : section.heading}
            </span>
            <label
              className="sr-only"
              htmlFor={`kind-${String(section.start)}`}
            >
              {content.sectionKind(section.heading || content.untitled)}
            </label>
            <select
              id={`kind-${String(section.start)}`}
              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={section.kind}
              onChange={(event) => {
                actions.setSectionKind(
                  section.start,
                  event.target.value as SectionKind,
                )
              }}
            >
              {sectionKinds.map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
            {section.headingLine !== undefined && (
              <>
                <Button
                  variant="link"
                  className="text-xs"
                  onClick={() => {
                    if (section.headingLine !== undefined)
                      actions.toggleHeading(section.headingLine, true)
                  }}
                >
                  {content.notHeading}
                </Button>
                <Button
                  variant="link"
                  className="text-xs"
                  onClick={() => {
                    if (section.headingLine !== undefined)
                      actions.setHeaderEnd(section.headingLine + 1)
                  }}
                >
                  {content.headerEndsHere}
                </Button>
              </>
            )}
          </div>
          <ol className="mt-1 space-y-1">
            {section.lines.map((index) => (
              <BodyLine
                key={index}
                line={parsed.lines[index]}
                status={parsed.statuses[index]}
                actions={actions}
              />
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function BodyLine({
  line,
  status,
  actions,
}: {
  line: CvLine | undefined
  status: LineStatus | undefined
  actions: LineActions
}) {
  if (line === undefined || status === undefined) return null
  const isWithheld = status.kind === 'withheld'
  const isPrivate = isWithheld && status.category === 'marked_private'
  const pii = status.kind === 'body' ? status.pii : []

  return (
    <li className="flex items-start justify-between gap-2">
      <span className={isWithheld ? 'text-slate-500 line-through' : undefined}>
        <Highlighted
          text={line.text}
          spans={pii}
          onRelease={actions.releaseSpan}
        />
        {isWithheld && (
          <span className="ml-1 text-xs no-underline">
            ({protectedCategoryLabels[status.category]})
          </span>
        )}
      </span>
      <span className="flex shrink-0 gap-2 text-xs">
        {isWithheld && !isPrivate ? (
          <Button
            variant="link"
            className="text-xs"
            onClick={() => {
              actions.toggleReleased(line.index)
            }}
          >
            {content.release}
          </Button>
        ) : (
          <Button
            variant="link"
            className="text-xs"
            onClick={() => {
              actions.togglePrivate(line.index)
            }}
          >
            {isPrivate ? content.unmarkPrivate : content.markPrivate}
          </Button>
        )}
        <Button
          variant="link"
          className="text-xs"
          onClick={() => {
            actions.toggleHeading(line.index, false)
          }}
        >
          {content.makeHeading}
        </Button>
        <Button
          variant="link"
          className="text-xs"
          onClick={() => {
            actions.setHeaderEnd(line.index + 1)
          }}
        >
          {content.headerEndsHere}
        </Button>
      </span>
    </li>
  )
}

function Highlighted({
  text,
  spans,
  onRelease,
}: {
  text: string
  spans: PiiSpan[]
  onRelease?: (text: string) => void
}) {
  const parts: ReactNode[] = []
  let cursor = 0
  spans.forEach((span, position) => {
    parts.push(text.slice(cursor, span.start))
    const isReleasable = onRelease !== undefined && !span.ownerConfirmed
    parts.push(
      <mark
        key={position}
        className="rounded bg-amber-200 px-0.5 line-through decoration-red-700"
        title={`${piiLabels[span.kind]}: stripped`}
      >
        <span className="sr-only">{piiLabels[span.kind]}: </span>
        {span.text}
        {isReleasable && (
          <button
            type="button"
            className="ml-1 text-xs text-slate-700 underline"
            aria-label={`${content.notPersonal}: ${span.text}`}
            onClick={() => {
              onRelease(span.text)
            }}
          >
            {content.notPersonal}
          </button>
        )}
      </mark>,
    )
    cursor = span.end
  })
  parts.push(text.slice(cursor))
  return <>{parts}</>
}

function StrippedPreview({ parsed }: { parsed: ParsedCv }) {
  const { stripped } = parsed
  const allLines = [
    ...stripped.summary,
    ...stripped.roles.flatMap((role) => [...role.header, ...role.lines]),
    ...stripped.education,
    ...stripped.skills,
    ...stripped.other,
  ]
  const characters = allLines.reduce((sum, line) => sum + line.text.length, 0)
  return (
    <details className="rounded-lg border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">
        {content.previewTitle(allLines.length, characters)}
      </summary>
      <div className="mt-3 space-y-3">
        <PreviewGroup title={content.groups.summary} lines={stripped.summary} />
        {stripped.roles.map((role, index) => (
          <div key={role.header[0]?.id ?? index}>
            <p className="font-medium">
              {content.groups.role(index + 1)}
              {role.datesUnparsed ? ` — ${content.datesUnparsed}` : ''}
            </p>
            <PreviewLines lines={[...role.header, ...role.lines]} />
          </div>
        ))}
        <PreviewGroup
          title={content.groups.education}
          lines={stripped.education}
        />
        <PreviewGroup title={content.groups.skills} lines={stripped.skills} />
        <PreviewGroup title={content.groups.other} lines={stripped.other} />
      </div>
    </details>
  )
}

function PreviewGroup({ title, lines }: { title: string; lines: IdLine[] }) {
  if (lines.length === 0) return null
  return (
    <div>
      <p className="font-medium">{title}</p>
      <PreviewLines lines={lines} />
    </div>
  )
}

function PreviewLines({ lines }: { lines: IdLine[] }) {
  return (
    <ol className="font-mono text-xs">
      {lines.map((line) => (
        <li key={line.id}>
          <span className="text-slate-500">{line.id}</span> {line.text}
        </li>
      ))}
    </ol>
  )
}

const sectionKinds: [SectionKind, string][] = [
  ['summary', 'Summary'],
  ['experience', 'Experience'],
  ['education', 'Education'],
  ['skills', 'Skills'],
  ['other', 'Other'],
]

const piiLabels: Record<PiiSpan['kind'], string> = {
  email: 'Email',
  phone: 'Phone',
  link: 'Link',
  address: 'Address',
  name: 'Name',
  private: 'Marked private',
}

const content = {
  title: 'Check what was parsed',
  intro: (fileName: string) =>
    `From ${fileName}. The header on the left is stripped entirely and never leaves this machine. Highlighted text is removed wherever it appears. Only the body on the right, after stripping, can later be sent to Jev, and only after a review before each send.`,
  noHeading:
    'No section heading was recognized, so the whole CV is treated as header and nothing would be sent. Use “Body starts here” to move the boundary.',
  photo:
    'An image was found on page 1, probably a photo. Images are never read, stored apart from the PDF, or sent.',
  termsTitle: 'Text stripped everywhere',
  nameLabel: 'Your name',
  nameHint: 'Stripped wherever it appears in the CV.',
  addressLabel: 'Your address',
  privateLabel: 'Other private text',
  releasedLabel:
    'Detected text you marked as not personal (select to strip again)',
  strip: 'Strip again:',
  add: 'Add',
  removeTerm: 'Remove',
  headerTitle: 'Header — stripped, never sent',
  headerHint: 'Everything above the first recognized section heading.',
  emptyHeader: 'No header lines.',
  bodyStartsHere: 'Body starts here',
  bodyTitle: 'Body — can be sent after stripping',
  bodyHint:
    'Sections as detected. Fix a section’s kind, headings, or private lines.',
  untitled: '(no heading)',
  sectionKind: (heading: string) => `Section kind for ${heading}`,
  notHeading: 'Not a heading',
  makeHeading: 'Make heading',
  headerEndsHere: 'Header ends here',
  markPrivate: 'Mark private',
  unmarkPrivate: 'Unmark private',
  release: 'Not protected',
  notPersonal: 'not personal',
  withheldTitle: 'Withheld as protected or private',
  noneWithheld: 'No lines withheld.',
  previewTitle: (count: number, characters: number) =>
    `Stripped CV body: ${String(count)} lines, ${String(characters)} characters`,
  groups: {
    summary: 'Summary',
    role: (number: number) => `Role ${String(number)}`,
    education: 'Education',
    skills: 'Skills',
    other: 'Other',
  },
  datesUnparsed: 'dates not parsed',
  confirm: 'Confirm parsed CV',
  saveFailed: 'Could not save. Try again.',
}
