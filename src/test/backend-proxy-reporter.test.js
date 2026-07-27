// @vitest-environment node
//
// Tests for the dev-server backend reporter (vite.backend-proxy.js).
//
// These use a REAL http server and REAL sockets rather than a mocked fetch: the
// whole point of the module is how it reacts to genuine connection failures, and
// a stubbed rejection would not reproduce Node's AggregateError shape — which is
// the exact thing that made the original output unreadable.

import { EventEmitter } from 'node:events'
import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'

import { PROXY_ERROR_PATTERN, createBackendReporter } from '../../vite.backend-proxy.js'

// Collects what the reporter printed, so assertions are about observable output.
function recordingLogger() {
  const lines = []
  return {
    lines,
    text: () => lines.map((l) => l.msg).join('\n'),
    info: (msg) => lines.push({ level: 'info', msg }),
    warn: (msg) => lines.push({ level: 'warn', msg }),
    error: (msg) => lines.push({ level: 'error', msg }),
  }
}

// A response double that records exactly what an http.ServerResponse would be
// asked to do. Real enough for the contract the reporter depends on.
function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
      this.headersSent = true
      return this
    },
    end(chunk = '') {
      this.body += chunk
      this.writableEnded = true
    },
  }
}

const servers = []

async function startServer(handler = (_req, res) => res.end('ok')) {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}

// A port that is guaranteed closed: bind one, read the port, then release it.
async function closedPortUrl() {
  const server = http.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return `http://127.0.0.1:${port}`
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise((resolve) => {
          s.closeAllConnections?.()
          s.close(resolve)
        }),
    ),
  )
})

const refused = new AggregateError([
  Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), { code: 'ECONNREFUSED' }),
])

describe('startup probe', () => {
  it('reports a live backend as online', async () => {
    const target = await startServer()
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target, logger })

    await expect(reporter.probe()).resolves.toBe(true)

    expect(reporter.status).toBe('online')
    expect(logger.text()).toContain('Backend online')
    expect(logger.text()).toContain(target)
  })

  it('still counts a non-2xx answer as online — the process replied', async () => {
    const target = await startServer((_req, res) => {
      res.writeHead(500)
      res.end('boom')
    })
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target, logger })

    await reporter.probe()

    expect(reporter.status).toBe('online')
  })

  it('reports a refused connection with the cause and the fix', async () => {
    const target = await closedPortUrl()
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target, logger, hint: 'npm run dev:server' })

    await expect(reporter.probe()).resolves.toBe(false)

    expect(reporter.status).toBe('offline')
    const out = logger.text()
    expect(out).toContain('Backend offline')
    expect(out).toContain('ECONNREFUSED')
    expect(out).toContain('nothing is listening on that port')
    expect(out).toContain('npm run dev:server')
    // The noise this replaces must not come back.
    expect(out).not.toContain('internalConnectMultiple')
    expect(out).not.toContain('AggregateError')
  })

  it('reports a hung backend as a timeout rather than waiting forever', async () => {
    // Never responds, so only the probe timeout can end the request.
    const target = await startServer(() => {})
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target, logger, probeTimeoutMs: 50 })

    await expect(reporter.probe()).resolves.toBe(false)

    expect(reporter.status).toBe('offline')
    expect(logger.text()).toContain('ETIMEDOUT')
  })
})

describe('proxy state transitions', () => {
  it('logs an outage once, no matter how many requests fail', () => {
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target: 'http://localhost:3001', logger })
    const proxy = new EventEmitter()
    reporter.configure(proxy)

    for (let i = 0; i < 25; i++) proxy.emit('error', refused, {}, fakeRes())

    expect(logger.lines.filter((l) => l.msg.includes('Backend offline'))).toHaveLength(1)
  })

  it('reads the code out of an AggregateError instead of showing "UNKNOWN"', () => {
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target: 'http://localhost:3001', logger })
    const proxy = new EventEmitter()
    reporter.configure(proxy)

    proxy.emit('error', refused, {}, fakeRes())

    expect(logger.text()).toContain('ECONNREFUSED')
    expect(logger.text()).not.toContain('UNKNOWN')
  })

  it('answers the browser with a JSON 503 instead of an empty 500', () => {
    const reporter = createBackendReporter({
      target: 'http://localhost:3001',
      logger: recordingLogger(),
    })
    const proxy = new EventEmitter()
    reporter.configure(proxy)
    const res = fakeRes()

    proxy.emit('error', refused, {}, res)

    expect(res.statusCode).toBe(503)
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(res.body)).toEqual({ ok: false, error: 'Backend unavailable.' })
  })

  it('does not write twice when the response is already committed', () => {
    const reporter = createBackendReporter({
      target: 'http://localhost:3001',
      logger: recordingLogger(),
    })
    const proxy = new EventEmitter()
    reporter.configure(proxy)
    const res = fakeRes()
    res.headersSent = true

    proxy.emit('error', refused, {}, res)

    expect(res.statusCode).toBe(0)
    expect(res.body).toBe('')
  })

  it('destroys the socket on a websocket upgrade failure, which has no writeHead', () => {
    const reporter = createBackendReporter({
      target: 'http://localhost:3001',
      logger: recordingLogger(),
    })
    const proxy = new EventEmitter()
    reporter.configure(proxy)
    const socket = {
      destroyed: false,
      destroy() {
        this.destroyed = true
      },
    }

    proxy.emit('error', refused, {}, socket)

    expect(socket.destroyed).toBe(true)
  })

  it('announces recovery with the outage length and how many requests failed', () => {
    const logger = recordingLogger()
    let clock = 0
    const reporter = createBackendReporter({
      target: 'http://localhost:3001',
      logger,
      now: () => clock,
    })
    const proxy = new EventEmitter()
    reporter.configure(proxy)

    proxy.emit('error', refused, {}, fakeRes())
    proxy.emit('error', refused, {}, fakeRes())
    proxy.emit('error', refused, {}, fakeRes())
    clock = 95_000
    proxy.emit('proxyRes')

    expect(reporter.status).toBe('online')
    const recovery = logger.lines.at(-1).msg
    expect(recovery).toContain('Backend back online')
    expect(recovery).toContain('1m 35s')
    expect(recovery).toContain('3 requests failed')
  })

  it('stays quiet while the backend keeps working', () => {
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target: 'http://localhost:3001', logger })
    const proxy = new EventEmitter()
    reporter.configure(proxy)

    for (let i = 0; i < 50; i++) proxy.emit('proxyRes')

    expect(logger.lines).toHaveLength(1)
  })

  it('reports a second outage after a recovery', () => {
    const logger = recordingLogger()
    const reporter = createBackendReporter({ target: 'http://localhost:3001', logger })
    const proxy = new EventEmitter()
    reporter.configure(proxy)

    proxy.emit('error', refused, {}, fakeRes())
    proxy.emit('proxyRes')
    proxy.emit('error', refused, {}, fakeRes())

    expect(logger.lines.filter((l) => l.msg.includes('Backend offline'))).toHaveLength(2)
  })
})

describe('PROXY_ERROR_PATTERN', () => {
  // Verbatim shapes Vite builds in dep-*.js, with and without colour support.
  it('matches the vite proxy errors this module replaces', () => {
    expect(PROXY_ERROR_PATTERN.test('http proxy error: /api/health\n    at x')).toBe(true)
    expect(PROXY_ERROR_PATTERN.test('\x1b[31mhttp proxy error: connect ECONNREFUSED\x1b[39m')).toBe(
      true,
    )
    expect(PROXY_ERROR_PATTERN.test('\x1b[31mws proxy error:\x1b[39m\n    at x')).toBe(true)
    expect(PROXY_ERROR_PATTERN.test('\x1b[31mws proxy socket error:\x1b[39m')).toBe(true)
  })

  it('leaves every other vite error alone', () => {
    expect(PROXY_ERROR_PATTERN.test('Internal server error: Failed to resolve import')).toBe(false)
    expect(PROXY_ERROR_PATTERN.test('[vite] Pre-transform error: Unexpected token')).toBe(false)
    // A user error that merely mentions the phrase must still be printed.
    expect(PROXY_ERROR_PATTERN.test('Failed to parse: see http proxy error docs')).toBe(false)
  })
})

describe('configuration', () => {
  it('refuses to build without a target rather than reporting about "undefined"', () => {
    expect(() => createBackendReporter({})).toThrow(/target/)
  })
})
