// MV3 service worker: the only code that will call Jev (docs/spec.md §3.1).
// Network code belongs only in src/background/provider/ (enforced by
// test/static/source-rules.test.ts).

import { restrictLocalStorage } from '../storage/store'

// Keys and the CV live in storage.local: keep them from injected scripts.
restrictLocalStorage().catch((error: unknown) => {
  console.error('Could not restrict storage.local to trusted contexts', error)
})

// First run opens the full tab on the setup screen (docs/spec.md §4.1).
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install')
    void chrome.tabs.create({ url: chrome.runtime.getURL('app.html') })
})
