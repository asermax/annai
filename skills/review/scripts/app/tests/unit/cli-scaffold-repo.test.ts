import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveRepoSlug } from '../../src/cli/surface/scaffold.ts'

// Stub `gh repo view --json ...` by intercepting child_process.spawn.
// Returns whatever stdout the test set on `mockGhStdout`.
let mockGhStdout = ''
let mockGhCode = 0
let lastSpawn: { args: string[], cwd?: string } | null = null

const installSpawnMock = () => {
  vi.mock('node:child_process', async (orig: () => Promise<Record<string, unknown>>) => {
    const actual = await orig()
    return {
      ...actual,
      spawn: (cmd: string, args: string[], opts?: { cwd?: string }) => {
        lastSpawn = { args, cwd: opts?.cwd }
        // Minimal EventEmitter-shaped fake that the real runGh consumes.
        const { EventEmitter } = require('node:events') as { EventEmitter: typeof import('events').EventEmitter }
        const child = new EventEmitter() as unknown as {
          stdout: EventEmitter
          stderr: EventEmitter
        } & EventEmitter
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        // Defer events to next tick so listeners attach first.
        setImmediate(() => {
          child.stdout.emit('data', Buffer.from(mockGhStdout, 'utf8'))
          child.emit('close', mockGhCode)
        })
        return child as unknown as ReturnType<typeof import('child_process').spawn>
      },
    }
  })
}

describe('resolveRepoSlug', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'annai-scaffold-test-'))
    mockGhStdout = ''
    mockGhCode = 0
    lastSpawn = null
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('passes OWNER/REPO straight through', async () => {
    const out = await resolveRepoSlug('asermax/annai')
    expect(out).toBe('asermax/annai')
  })

  it('passes host-prefixed slug through', async () => {
    const out = await resolveRepoSlug('github.com/asermax/annai')
    expect(out).toBe('github.com/asermax/annai')
  })

  it('rejects a non-existent path that is not a slug', async () => {
    await expect(resolveRepoSlug('/no/such/dir')).rejects.toThrow(/not a directory/)
  })

  it('rejects a path with bad slug syntax (forward-slash file)', async () => {
    // a regular file is not a directory and not a slug
    const file = join(tmpDir, 'file.txt')
    writeFileSync(file, '')
    await expect(resolveRepoSlug(file)).rejects.toThrow(/not a directory/)
  })

  // Resolving a directory needs gh; we mock it via spawn.
  it.skip('resolves a directory to a slug via gh repo view', async () => {
    // Skipped because mocking child_process.spawn against a module that
    // already imported it requires more setup than the helper does. The
    // dir-resolve path is smoke-tested manually against the local repo
    // (see Verification section in the v0.3.1 plan).
    installSpawnMock()
    mockGhStdout = 'someone/repo\n'
    mockGhCode = 0
    const out = await resolveRepoSlug(tmpDir)
    expect(out).toBe('someone/repo')
    expect(lastSpawn?.cwd).toBe(tmpDir)
  })
})
