import { mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { sessionPaths } from '../shared/paths.ts'
import { surfaceSchema } from '../shared/surface.ts'
import { sendCommand } from './ipc-client.ts'

const here = dirname(fileURLToPath(import.meta.url))
const DAEMON_ENTRY = resolve(here, '../daemon/daemon.js')  // dist/cli → dist/daemon/daemon.js

export interface StartArgs {
  surfacePath: string
  sessionId: string
  repoPath?: string
  noOpen: boolean
}

export const parseStartArgs = (argv: string[]): StartArgs => {
  let surfacePath: string | undefined
  let sessionId: string | undefined
  let repoPath: string | undefined
  let noOpen = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--surface' && i + 1 < argv.length) { surfacePath = argv[i + 1]; i++; continue }
    if (arg === '--session' && i + 1 < argv.length) { sessionId = argv[i + 1]; i++; continue }
    if (arg === '--repo' && i + 1 < argv.length) { repoPath = argv[i + 1]; i++; continue }
    if (arg === '--no-open') { noOpen = true; continue }
    if (arg === '--port' && i + 1 < argv.length) { i++; continue }  // accepted, currently ignored (auto)
    throw new Error(`start: unknown argument "${arg}"`)
  }

  if (surfacePath == null) throw new Error('start: --surface <path> is required')
  if (sessionId == null) throw new Error('start: --session <id> is required')

  return { surfacePath, sessionId, repoPath, noOpen }
}

const openBrowser = (url: string): void => {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  try {
    const child = spawn(cmd, [url], { detached: true, stdio: 'ignore' })
    child.unref()
  } catch {
    // not fatal — the agent will still print the URL
  }
}

export const runStart = async (argv: string[]): Promise<void> => {
  const args = parseStartArgs(argv)
  const paths = sessionPaths(args.sessionId)

  mkdirSync(paths.dir, { recursive: true })

  // validate surface before doing anything else
  const raw = readFileSync(args.surfacePath, 'utf8')
  surfaceSchema.parse(JSON.parse(raw))

  copyFileSync(args.surfacePath, paths.surface)

  // spawn detached daemon
  const child = spawn(process.execPath, [DAEMON_ENTRY, '--session', args.sessionId], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  })
  if (child.pid == null) throw new Error('start: failed to spawn daemon')

  writeFileSync(paths.pid, String(child.pid) + '\n', 'utf8')
  child.unref()

  // poll the sock until ping returns
  const deadline = Date.now() + 5000
  let lastErr: unknown = null
  while (Date.now() < deadline) {
    if (existsSync(paths.sock)) {
      try {
        const response = await sendCommand(paths.sock, { op: 'ping' }, 1000)
        if (response.ok) break
        lastErr = response.error
      } catch (err) {
        lastErr = err
      }
    }
    await delay(100)
  }

  if (!existsSync(paths.state)) {
    throw new Error(`start: daemon did not come up within 5s${lastErr != null ? ` (${String(lastErr)})` : ''}`)
  }

  const state = JSON.parse(readFileSync(paths.state, 'utf8')) as { port: number | null }
  if (state.port == null) throw new Error('start: daemon state has no port')

  const url = `http://127.0.0.1:${state.port}/`

  if (!args.noOpen) openBrowser(url)

  process.stdout.write(JSON.stringify({ sessionId: args.sessionId, url }) + '\n')
}
