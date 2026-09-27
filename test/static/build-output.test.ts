// @vitest-environment node
// Builds the extension into a temporary directory and checks the unpacked
// layout the manifest expects.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { repoRoot } from './scan-source'

let outDir = ''

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'jobfit-jev-build-'))
  await build({
    configFile: resolve(repoRoot, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  })
}, 60_000)

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true })
})

describe('unpacked build', () => {
  it('copies the manifest unchanged', () => {
    expect(readOutput('manifest.json')).toBe(
      readFileSync(resolve(repoRoot, 'public/manifest.json'), 'utf8'),
    )
  })

  it('emits every file the extension opens at the root', () => {
    const missing = ['background.js', 'popup.html', 'app.html'].filter(
      (file) => !existsSync(join(outDir, file)),
    )
    expect(missing).toEqual([])
  })

  it.each(['popup.html', 'app.html'])(
    '%s loads only bundled external scripts',
    (page) => {
      const scripts = [
        ...readOutput(page).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g),
      ]
      expect(scripts).not.toEqual([])
      for (const [, attributes = '', body = ''] of scripts) {
        expect(body.trim()).toBe('')
        expect(attributes).toMatch(/\bsrc="\.\/assets\/[^"]+\.js"/)
      }
    },
  )
})

function readOutput(file: string): string {
  return readFileSync(join(outDir, file), 'utf8')
}
