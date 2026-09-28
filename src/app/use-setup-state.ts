import { useCallback, useEffect, useState } from 'react'
import type { SetupState } from '../core/settings'
import { readSetupState } from '../storage/store'

export function useSetupState() {
  const [state, setState] = useState<SetupState>()
  const [loadError, setLoadError] = useState<string>()

  const load = useCallback(
    () =>
      readSetupState().then(setState, () => {
        setLoadError('Could not read the extension storage. Reload this page.')
      }),
    [],
  )

  useEffect(() => {
    void load()
  }, [load])

  return { state, loadError, reload: load }
}

export function useHashRoute(): string {
  const [hash, setHash] = useState(readHash)
  useEffect(() => {
    const onChange = () => {
      setHash(readHash())
    }
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
    }
  }, [])
  return hash
}

export function navigate(hash: string) {
  window.location.hash = hash
}

function readHash(): string {
  return window.location.hash.replace(/^#/, '') || '/'
}
