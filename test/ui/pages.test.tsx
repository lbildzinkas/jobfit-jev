import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/app'
import { Popup } from '../../src/popup/popup'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('popup', () => {
  it('renders the empty popup', () => {
    render(<Popup />)
    expect(screen.getByRole('heading', { name: 'jobfit-jev' })).toBeTruthy()
  })

  it('opens the full tab from the popup', () => {
    const createTab = vi.fn(() => Promise.resolve({}))
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
      tabs: { create: createTab },
    })

    render(<Popup />)
    fireEvent.click(screen.getByRole('button', { name: 'Open full tab' }))

    expect(createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://test/app.html',
    })
  })
})

describe('full tab', () => {
  it('renders the empty page', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'jobfit-jev' })).toBeTruthy()
  })
})
