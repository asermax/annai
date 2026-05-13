import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { getSessionsRoot, sessionPaths } from '../shared/paths.ts'

interface SessionListing {
  sessionId: string
  pid: number | null
  active: boolean
  startedAt: string | null
  port: number | null
}

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)

    return true
  } catch {
    return false
  }
}

export const runSessions = async (_argv: string[]): Promise<void> => {
  const root = getSessionsRoot()
  if (!existsSync(root)) {
    process.stdout.write(JSON.stringify({ sessions: [] }, null, 2) + '\n')
    return
  }

  const listings: SessionListing[] = []

  for (const entry of readdirSync(root)) {
    const paths = sessionPaths(entry)
    if (!statSync(paths.dir, { throwIfNoEntry: false })?.isDirectory()) continue

    let pid: number | null = null
    if (existsSync(paths.pid)) {
      const raw = readFileSync(paths.pid, 'utf8').trim()
      const parsed = Number.parseInt(raw, 10)
      pid = Number.isFinite(parsed) ? parsed : null
    }

    let startedAt: string | null = null
    let port: number | null = null
    if (existsSync(paths.state)) {
      try {
        const state = JSON.parse(readFileSync(paths.state, 'utf8')) as { startedAt?: string, port?: number | null }
        startedAt = state.startedAt ?? null
        port = state.port ?? null
      } catch {
        // ignore unreadable state
      }
    }

    listings.push({
      sessionId: entry,
      pid,
      active: pid != null && isPidAlive(pid),
      startedAt,
      port,
    })
  }

  process.stdout.write(JSON.stringify({ sessions: listings }, null, 2) + '\n')
}
