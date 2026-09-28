import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Popup } from '../../src/popup/popup'
import { installFakeChrome } from '../support/fake-chrome'
import { completeSetup } from './setup-data'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('popup', () => {
  it('asks to finish setup and opens the full tab for it', async () => {
    const { chrome } = installFakeChrome()
    render(<Popup />)

    fireEvent.click(await screen.findByRole('button', { name: 'Finish setup' }))

    expect(screen.getByText(/Setup needed/)).toBeTruthy()
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/app.html',
    })
  })

  it('shows the route and model once setup is complete', async () => {
    const { chrome } = installFakeChrome(completeSetup())
    render(<Popup />)

    expect(
      await screen.findByText(/OpenRouter \(default\) · typesafe\/jev-1\.13/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Analyze' })).toHaveProperty(
      'disabled',
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    await waitFor(() => {
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/app.html#/settings',
      })
    })
  })
})
