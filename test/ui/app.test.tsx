// First-run setup, the parsed-CV confirmation, and settings in the full tab
// (docs/spec.md §4), against in-memory extension storage.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/app'
import type { PdfText } from '../../src/core/cv/types'
import { defaultSettings, type StoredCv } from '../../src/core/settings'
import { person } from '../cv/synthetic'
import { installFakeChrome } from '../support/fake-chrome'
import { completeSetup, fakeKey, importedCv } from './setup-data'

const readCvPdf = vi.fn<(bytes: Uint8Array) => Promise<PdfText>>()
vi.mock('../../src/cv-import/browser-pdfjs', () => ({ readCvPdf }))

beforeEach(() => {
  window.location.hash = ''
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  readCvPdf.mockReset()
})

describe('first-run setup', () => {
  it('saves the route and key, then moves on to the CV', async () => {
    const { local } = installFakeChrome()
    render(<App />)

    fireEvent.change(
      await screen.findByLabelText('API key for OpenRouter (default)'),
      {
        target: { value: ` ${fakeKey} ` },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect(await screen.findByLabelText('CV (PDF)')).toBeTruthy()
    expect(local.get('apiKeys')).toEqual({ openrouter: fakeKey })
    expect(local.get('settings')).toMatchObject({
      route: 'openrouter',
      models: { openrouter: 'typesafe/jev-1.13' },
    })
  })

  it('needs a key before continuing', async () => {
    const { local } = installFakeChrome()
    render(<App />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save and continue' }),
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Enter your API key/,
    )
    expect(local.has('settings')).toBe(false)
  })

  it('asks for the TypeSafe host permission and keeps the route when refused', async () => {
    const { chrome, local } = installFakeChrome()
    chrome.permissions.request.mockResolvedValueOnce(false)
    render(<App />)

    fireEvent.click(await screen.findByLabelText('TypeSafe direct'))
    fireEvent.change(screen.getByLabelText('API key for TypeSafe direct'), {
      target: { value: fakeKey },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/permission/)
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ['https://api.typesafe.ai/*'],
    })
    expect(local.has('settings')).toBe(false)
  })

  it('imports a PDF CV and opens the parsed-CV confirmation', async () => {
    const { local } = installFakeChrome({
      settings: defaultSettings,
      apiKeys: { openrouter: fakeKey },
    })
    const text = `${person.name} ${'Backend engineer. '.repeat(20)}`
    readCvPdf.mockResolvedValue({
      pages: [
        {
          runs: [
            { text: person.name, x: 72, y: 740, width: 150, fontSize: 20 },
            { text: 'Summary', x: 72, y: 700, width: 60, fontSize: 13 },
            { text, x: 72, y: 684, width: 400, fontSize: 10 },
          ],
        },
      ],
      hasImageOnFirstPage: false,
    })
    render(<App />)

    const input = await screen.findByLabelText('CV (PDF)')
    const file = new File(['%PDF-1.4 synthetic'], 'synthetic.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByRole('heading', { name: 'Check what was parsed' }),
    ).toBeTruthy()
    const cv = local.get('cv') as StoredCv
    expect(cv.fileName).toBe('synthetic.pdf')
    expect(cv.confirmedAt).toBeUndefined()
    expect(cv.corrections.name).toBe(person.name)
  })

  it('refuses a scanned PDF and offers the paste fallback', async () => {
    installFakeChrome({
      settings: defaultSettings,
      apiKeys: { openrouter: fakeKey },
    })
    readCvPdf.mockResolvedValue({
      pages: [{ runs: [] }],
      hasImageOnFirstPage: true,
    })
    render(<App />)

    fireEvent.change(await screen.findByLabelText('CV (PDF)'), {
      target: {
        files: [
          new File(['%PDF-1.4 scan'], 'scan.pdf', { type: 'application/pdf' }),
        ],
      },
    })

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /scanned PDF/,
    )
    expect(screen.getByLabelText('CV text')).toBeTruthy()
  })

  it('confirms the parsed CV, then offers the optional eligibility step', async () => {
    const { local } = installFakeChrome({
      settings: defaultSettings,
      apiKeys: { openrouter: fakeKey },
      cv: importedCv(),
    })
    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm parsed CV' }),
    )

    expect(await screen.findByLabelText('Current location')).toBeTruthy()
    expect((local.get('cv') as StoredCv).confirmedAt).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(
      await screen.findByRole('heading', { name: 'Setup is complete' }),
    ).toBeTruthy()
    expect(local.get('settings')).toMatchObject({ eligibilityStepDone: true })
    expect(local.has('eligibility')).toBe(false)
  })
})

describe('parsed-CV confirmation', () => {
  async function openReview() {
    const fake = installFakeChrome({
      settings: defaultSettings,
      apiKeys: { openrouter: fakeKey },
      cv: importedCv(),
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Check what was parsed' })
    return fake
  }

  it('shows the header to strip beside the body to send', async () => {
    await openReview()
    const header = screen.getByRole('region', {
      name: 'Header — stripped, never sent',
    })
    const body = screen.getByRole('region', {
      name: 'Body — can be sent after stripping',
    })

    expect(within(header).getByText(person.name, { exact: false })).toBeTruthy()
    expect(within(header).getByText('Email:', { exact: false })).toBeTruthy()
    expect(
      within(body).getByText(/Backend engineer with eight years/),
    ).toBeTruthy()
    expect(within(body).queryByText(person.email)).toBeNull()
    expect(screen.getByText(/An image was found on page 1/)).toBeTruthy()
  })

  it('lists the lines withheld as protected attributes, with the reason', async () => {
    await openReview()
    const withheld = screen.getByRole('region', {
      name: 'Withheld as protected or private',
    })
    expect(within(withheld).getByText(/date of birth or age/)).toBeTruthy()
    expect(
      within(withheld).getByText(/nationality or citizenship/),
    ).toBeTruthy()
  })

  it('stores the owner’s corrections with the CV', async () => {
    const { local } = await openReview()
    const body = screen.getByRole('region', {
      name: 'Body — can be sent after stripping',
    })
    const languagesLine = within(body)
      .getByText('English (native), Spanish (professional)')
      .closest('li')
    if (languagesLine === null) throw new Error('line missing')
    fireEvent.click(
      within(languagesLine).getByRole('button', { name: 'Mark private' }),
    )
    fireEvent.change(screen.getByLabelText('Other private text'), {
      target: { value: 'Northwind Payments' },
    })
    fireEvent.click(nth(screen.getAllByRole('button', { name: 'Add' }), 1))

    fireEvent.click(screen.getByRole('button', { name: 'Confirm parsed CV' }))

    await waitFor(() => {
      expect((local.get('cv') as StoredCv).confirmedAt).toBeDefined()
    })
    const cv = local.get('cv') as StoredCv
    expect(cv.corrections.privateLines).toEqual([19])
    expect(cv.corrections.privateStrings).toEqual(['Northwind Payments'])
    const sent = JSON.stringify(cv.stripped)
    expect(sent).not.toContain('Spanish (professional)')
    expect(sent).not.toContain('Northwind')
  })

  it('moves the header boundary', async () => {
    await openReview()
    const header = screen.getByRole('region', {
      name: 'Header — stripped, never sent',
    })
    fireEvent.click(
      nth(
        within(header).getAllByRole('button', { name: 'Body starts here' }),
        1,
      ),
    )
    const body = screen.getByRole('region', {
      name: 'Body — can be sent after stripping',
    })
    expect(within(body).getByText('Senior Software Engineer')).toBeTruthy()
  })
})

describe('settings', () => {
  function openSettings(initial = completeSetup()) {
    window.location.hash = '#/settings'
    const fake = installFakeChrome(initial)
    render(<App />)
    return fake
  }

  it('shows the key masked and reveals it on request', async () => {
    openSettings()
    const stored = await screen.findByTestId('stored-key')
    expect(stored.textContent).not.toBe(fakeKey)
    expect(stored.textContent).toContain('•')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByTestId('stored-key').textContent).toBe(fakeKey)
  })

  it('removes the key only after confirmation', async () => {
    const { local } = openSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(local.get('apiKeys')).toEqual({ openrouter: fakeKey })
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }))
    await waitFor(() => {
      expect(local.get('apiKeys')).toEqual({})
    })
    expect(await screen.findByText(/Setup is not complete/)).toBeTruthy()
  })

  it('keeps one key per route', async () => {
    const initial = completeSetup()
    const { local } = openSettings({
      ...initial,
      apiKeys: { openrouter: fakeKey, typesafe: `${fakeKey}-ts` },
    })
    fireEvent.click(await screen.findByLabelText('TypeSafe direct'))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => {
      expect(local.get('settings')).toMatchObject({ route: 'typesafe' })
    })
    expect(local.get('apiKeys')).toEqual({
      openrouter: fakeKey,
      typesafe: `${fakeKey}-ts`,
    })
  })

  it('shows the data-boundary map', async () => {
    openSettings()
    expect(
      await screen.findByRole('columnheader', {
        name: 'Never leaves this machine',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('columnheader', {
        name: 'Stripped in code before sending',
      }),
    ).toBeTruthy()
  })

  it('deletes all extension data after confirmation', async () => {
    const { local, session } = openSettings()
    session.set('analysis', {})
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete all extension data' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    await waitFor(() => {
      expect(local.size).toBe(0)
    })
    expect(session.size).toBe(0)
    expect(
      await screen.findByRole('heading', { name: 'First-run setup' }),
    ).toBeTruthy()
  })

  it('deletes the CV after confirmation', async () => {
    const { local } = openSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete CV' }))
    await waitFor(() => {
      expect(local.has('cv')).toBe(false)
    })
  })
})

function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index]
  if (element === undefined) throw new Error(`No element at ${String(index)}`)
  return element
}
