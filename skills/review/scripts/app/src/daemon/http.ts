import { createServer } from 'node:http'
import type { Server, IncomingMessage, ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve, normalize, extname } from 'node:path'
import type { Surface } from '../shared/surface.ts'

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
}

const isInside = (parent: string, child: string): boolean => {
  const rel = normalize(child).startsWith(normalize(parent))

  return rel
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

  if (path === '/api/surface') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(opts.surface))

    return
  }

  if (path === '/' || path === '/index.html') {
    await sendFile(res, join(opts.frontendDir, 'index.html'))
    return
  }

  // anything else: serve as static under frontendDir
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
