import { useState } from 'react'
import {
  importFailureMessages,
  importPastedText,
  importPdf,
  type ImportResult,
} from '../../cv-import/import-cv'
import { writeLocal } from '../../storage/store'
import { Button, Notice, inputClass } from '../../ui/controls'

export function CvImport({ onImported }: { onImported: () => Promise<void> }) {
  const [error, setError] = useState<string>()
  const [isReading, setIsReading] = useState(false)
  const [isPasting, setIsPasting] = useState(false)
  const [pasted, setPasted] = useState('')

  const store = async (result: ImportResult) => {
    if (!result.ok) {
      setError(importFailureMessages[result.failure])
      if (result.failure !== 'too_little_text') setIsPasting(true)
      return
    }
    try {
      await writeLocal('cv', result.cv)
    } catch {
      setError(content.saveFailed)
      return
    }
    await onImported()
  }

  const readFile = async (file: File) => {
    setError(undefined)
    setIsReading(true)
    try {
      // pdf.js loads only when a CV is imported.
      const { readCvPdf } = await import('../../cv-import/browser-pdfjs')
      const bytes = new Uint8Array(await file.arrayBuffer())
      await store(await importPdf({ name: file.name, bytes }, readCvPdf))
    } finally {
      setIsReading(false)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p>{content.intro}</p>
      <label className="block font-medium" htmlFor="cv-file">
        {content.fileLabel}
      </label>
      <input
        id="cv-file"
        type="file"
        accept="application/pdf,.pdf"
        disabled={isReading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file !== undefined) void readFile(file)
        }}
      />
      {isReading && <p className="text-slate-600">{content.reading}</p>}
      {error !== undefined && <Notice tone="error">{error}</Notice>}

      {isPasting ? (
        <div className="space-y-2">
          <label className="block font-medium" htmlFor="cv-text">
            {content.pasteLabel}
          </label>
          <textarea
            id="cv-text"
            className={`${inputClass} h-64 font-mono`}
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value)
            }}
          />
          <Button
            onClick={() => {
              setError(undefined)
              void store(importPastedText(pasted))
            }}
          >
            {content.usePasted}
          </Button>
        </div>
      ) : (
        <Button
          variant="link"
          onClick={() => {
            setIsPasting(true)
          }}
        >
          {content.pasteInstead}
        </Button>
      )}
    </div>
  )
}

const content = {
  intro:
    'Pick one text-based PDF of your CV. It is read on this machine with pdf.js; nothing is uploaded. You review what was found before anything can be sent.',
  fileLabel: 'CV (PDF)',
  reading: 'Reading the PDF on this machine…',
  pasteInstead: 'Paste the CV text instead',
  pasteLabel: 'CV text',
  usePasted: 'Use pasted text',
  saveFailed:
    'Could not save the CV in local extension storage. Try a smaller PDF, or paste the CV text instead.',
}
