import { createServer } from 'node:http'
import type { Server, IncomingMessage, ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve, normalize, extname } from 'node:path'

import { z } from 'zod'

import type { Surface } from '../shared/surface.ts'
import { draftInputSchema, draftPatchSchema } from '../shared/drafts.ts'
import { REVIEW_DECISIONS } from '../shared/result.ts'
import { sessionPaths } from '../shared/paths.ts'
import type { EventBus } from './events.ts'
import { Session, writeResultAtomic } from './session.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

export interface StartHttpServerOptions {
  frontendDir: string   // absolute path to dist/frontend
  surface: Surface
  session: Session
  bus: EventBus
  shutdown: (reason: string) => void
}

const submitBodySchema = z.object({
  decision: z.enum([REVIEW_DECISIONS.approve, REVIEW_DECISIONS.comment]),
})

const prBodySchema = z.object({
  prBody: z.string(),
})

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')

  return text.length > 0 ? JSON.parse(text) : {}
}

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const sendError = (res: ServerResponse, status: number, message: string): void => {
  sendJson(res, status, { error: message })
}

const matchDraftIdRoute = (path: string): string | null => {
  const m = path.match(/^\/api\/drafts\/([^/]+)$/)
  return m?.[1] ?? null
}

const handleApiRoute = async (
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string,
  opts: StartHttpServerOptions,
): Promise<boolean> => {
  if (path === '/api/surface' && method === 'GET') {
    sendJson(res, 200, opts.surface)
    return true
  }

  if (path === '/api/state' && method === 'GET') {
    sendJson(res, 200, opts.session.snapshot())
    return true
  }

  if (path === '/api/drafts' && method === 'POST') {
    const body = await readJsonBody(req)
    const parsed = draftInputSchema.safeParse(body)
    if (!parsed.success) {
      sendError(res, 400, parsed.error.message)
      return true
    }

    const draft = opts.session.addDraft(parsed.data)
    opts.bus.emit({ kind: 'comment-drafted', at: new Date().toISOString() })

    sendJson(res, 201, draft)
    return true
  }

  const draftId = matchDraftIdRoute(path)
  if (draftId != null) {
    if (method === 'PATCH') {
      const body = await readJsonBody(req)
      const parsed = draftPatchSchema.safeParse(body)
      if (!parsed.success) {
        sendError(res, 400, parsed.error.message)
        return true
      }

      const updated = opts.session.editDraft(draftId, parsed.data)
      if (updated == null) {
        sendError(res, 404, 'draft not found')
        return true
      }

      opts.bus.emit({ kind: 'comment-edited', at: new Date().toISOString() })
      sendJson(res, 200, updated)
      return true
    }

    if (method === 'DELETE') {
      const removed = opts.session.dismissDraft(draftId)
      if (!removed) {
        sendError(res, 404, 'draft not found')
        return true
      }

      opts.bus.emit({ kind: 'comment-dismissed', at: new Date().toISOString() })
      sendJson(res, 200, { ok: true })
      return true
    }

    sendError(res, 405, 'method not allowed')
    return true
  }

  if (path === '/api/pr-body' && method === 'PUT') {
    const body = await readJsonBody(req)
    const parsed = prBodySchema.safeParse(body)
    if (!parsed.success) {
      sendError(res, 400, parsed.error.message)
      return true
    }

    opts.session.setPrBody(parsed.data.prBody)
    sendJson(res, 200, { ok: true })
    return true
  }

  if (path === '/api/submit' && method === 'POST') {
    const body = await readJsonBody(req)
    const parsed = submitBodySchema.safeParse(body)
    if (!parsed.success) {
      sendError(res, 400, parsed.error.message)
      return true
    }

    const decision = parsed.data.decision

    opts.session.setDecision(decision)
    opts.bus.emit({ kind: 'decision-set', at: new Date().toISOString() })

    const result = opts.session.buildResult()
    const paths = sessionPaths(opts.session.sessionId)
    writeResultAtomic(paths.result, result)

    opts.bus.emit({
      kind: 'review-submitted',
      at: new Date().toISOString(),
      decision,
      commentCount: result.comments.length,
    })

    sendJson(res, 200, { ok: true, commentCount: result.comments.length })
    return true
  }

  if (path === '/api/dismiss' && method === 'POST') {
    sendJson(res, 200, { ok: true })
    setImmediate(() => opts.shutdown('dismissed-by-reviewer'))
    return true
  }

  if (path.startsWith('/api/')) {
    sendError(res, 404, 'not found')
    return true
  }

  return false
}

const isInside = (parent: string, child: string): boolean => {
  return normalize(child).startsWith(normalize(parent))
}

const sendNotFound = (res: ServerResponse): void => {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Not Found')
}

const sendFile = async (res: ServerResponse, filePath: string): Promise<void> => {
  try {
    const data = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    res.statusCode = 200
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
    res.end(data)
  } catch {
    sendNotFound(res)
  }
}

const handleRequest = (opts: StartHttpServerOptions) => async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  const handled = await handleApiRoute(req, res, path, method, opts)
  if (handled) return

  if (path === '/' || path === '/index.html') {
    await sendFile(res, join(opts.frontendDir, 'index.html'))
    return
  }

  const candidate = resolve(opts.frontendDir, '.' + path)
  if (!isInside(opts.frontendDir, candidate)) {
    sendNotFound(res)
    return
  }

  try {
    const s = await stat(candidate)
    if (s.isFile()) {
      await sendFile(res, candidate)
      return
    }
  } catch {
    // fall through to 404
  }

  sendNotFound(res)
}

export const startHttpServer = (opts: StartHttpServerOptions): Promise<{ server: Server, port: number }> => {
  const server = createServer((req, res) => {
    handleRequest(opts)(req, res).catch(err => {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`Internal Server Error\n${err instanceof Error ? err.message : String(err)}`)
    })
  })

  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr == null || typeof addr === 'string') {
        rejectListen(new Error('failed to read assigned port'))
        return
      }
      server.off('error', rejectListen)
      resolveListen({ server, port: addr.port })
    })
  })
}
