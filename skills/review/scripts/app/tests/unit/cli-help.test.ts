import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { runStart } from '../../src/cli/start.ts'
import { runStop } from '../../src/cli/stop.ts'
import { runStatus } from '../../src/cli/status.ts'
import { runResult } from '../../src/cli/result.ts'
import { runSubmit } from '../../src/cli/submit.ts'
import { runSessions } from '../../src/cli/sessions.ts'
import { runWatch } from '../../src/cli/watch.ts'
import { runReply } from '../../src/cli/reply.ts'
import { runSurface } from '../../src/cli/surface.ts'

// Verify every CLI command honours --help by printing its USAGE string
// and returning without error. The handoff specifically called out that
// `annai.sh surface scaffold --help` threw "unknown argument" in 0.3.0.

const topLevel: Array<[string, (argv: string[]) => Promise<void>]> = [
  ['start', runStart],
  ['stop', runStop],
  ['status', runStatus],
  ['result', runResult],
  ['submit', runSubmit],
  ['sessions', runSessions],
  ['watch', runWatch],
  ['reply', runReply],
  ['surface', runSurface],
]

const surfaceOps = [
  'scaffold',
  'group-add', 'group-update', 'group-drop',
  'diff-move', 'diff-drop',
  'annotation-add', 'annotation-update', 'annotation-drop',
  'suggestion-add', 'suggestion-update', 'suggestion-drop',
  'diagram-add', 'diagram-update', 'diagram-drop',
  'set-tldr', 'set-review-prompts',
  'validate', 'show',
]

describe('cli --help', () => {
  let stdout: string
  let writeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdout = ''
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout += typeof chunk === 'string' ? chunk : (chunk as Buffer).toString()
      return true
    })
  })

  afterEach(() => {
    writeSpy.mockRestore()
  })

  for (const [name, run] of topLevel) {
    it(`${name} --help prints usage`, async () => {
      await expect(run(['--help'])).resolves.toBeUndefined()
      expect(stdout).toMatch(/usage:/i)
    })
  }

  for (const op of surfaceOps) {
    it(`surface ${op} --help prints usage`, async () => {
      await expect(runSurface([op, '--help'])).resolves.toBeUndefined()
      expect(stdout).toMatch(/usage:/i)
    })
  }
})
