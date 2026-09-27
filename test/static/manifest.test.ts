// The manifest must stay the one in docs/spec.md §3.2, and the §11.1 static
// checks on it: no content scripts and no LinkedIn host access.
import { describe, expect, it } from 'vitest'
import { readRepoFile } from './scan-source'

const manifest = JSON.parse(
  readRepoFile('public/manifest.json'),
) as chrome.runtime.ManifestV3
const packageJson = JSON.parse(readRepoFile('package.json')) as {
  version: string
}

describe('manifest', () => {
  it('declares no content scripts', () => {
    expect(manifest).not.toHaveProperty('content_scripts')
  })

  it('grants no access to LinkedIn, directly or through a wildcard', () => {
    const requested = [
      ...(manifest.permissions ?? []),
      ...(manifest.optional_permissions ?? []),
      ...(manifest.host_permissions ?? []),
      ...(manifest.optional_host_permissions ?? []),
    ]
    expect(requested.filter(grantsLinkedInAccess)).toEqual([])
  })

  it('requests exactly the permissions in the spec', () => {
    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage'])
    expect(manifest.host_permissions).toEqual(['https://openrouter.ai/*'])
    expect(manifest.optional_host_permissions).toEqual([
      'https://api.typesafe.ai/*',
    ])
    expect(manifest).not.toHaveProperty('optional_permissions')
  })

  it('runs a module service worker and a toolbar popup', () => {
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.background).toEqual({
      service_worker: 'background.js',
      type: 'module',
    })
    expect(manifest.action).toEqual({ default_popup: 'popup.html' })
  })

  it('allows only bundled scripts on extension pages', () => {
    expect(manifest.content_security_policy).toEqual({
      extension_pages: "script-src 'self'; object-src 'self'",
    })
  })

  it('keeps its version in step with package.json', () => {
    expect(manifest.version).toBe(packageJson.version)
  })
})

describe('grantsLinkedInAccess', () => {
  it.each([
    'https://www.linkedin.com/*',
    '*://*.linkedin.com/*',
    'https://linkedin.com/jobs/*',
    'https://static.licdn.com/*',
    '<all_urls>',
    '*://*/*',
    'https://*/*',
  ])('flags %s', (pattern) => {
    expect(grantsLinkedInAccess(pattern)).toBe(true)
  })

  it.each([
    'storage',
    'activeTab',
    'https://openrouter.ai/*',
    'https://api.typesafe.ai/*',
  ])('allows %s', (pattern) => {
    expect(grantsLinkedInAccess(pattern)).toBe(false)
  })
})

function grantsLinkedInAccess(pattern: string): boolean {
  if (pattern === '<all_urls>') return true

  const host = /^[a-z*]+:\/\/([^/]*)\//.exec(pattern)?.[1]
  if (host === undefined) return false
  if (host === '*') return true

  return linkedInHosts.some((name) => host.includes(name))
}

const linkedInHosts = ['linkedin', 'licdn']
