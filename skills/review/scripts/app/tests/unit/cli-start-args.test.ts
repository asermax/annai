import { describe, it, expect } from 'vitest'

import { parseStartArgs } from '../../src/cli/start.ts'

describe('parseStartArgs', () => {
  it('parses the happy path', () => {
    const args = parseStartArgs(['--surface', '/tmp/s.json', '--session', 'smoke1', '--repo', '/home/u/repo'])
    expect(args).toEqual({
      surfacePath: '/tmp/s.json',
      sessionId: 'smoke1',
      repoPath: '/home/u/repo',
      noOpen: false,
    })
  })

  it('honours --no-open', () => {
    const args = parseStartArgs(['--surface', '/tmp/s.json', '--session', 'x', '--no-open'])
    expect(args.noOpen).toBe(true)
  })

  it('throws when --surface is missing', () => {
    expect(() => parseStartArgs(['--session', 'x'])).toThrow(/--surface/)
  })

  it('throws when --session is missing', () => {
    expect(() => parseStartArgs(['--surface', '/tmp/s.json'])).toThrow(/--session/)
  })

  it('throws on unknown arguments', () => {
    expect(() => parseStartArgs(['--surface', '/tmp/s.json', '--session', 'x', '--bogus'])).toThrow(/unknown argument/)
  })
})
