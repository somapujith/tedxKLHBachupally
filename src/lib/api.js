// Shared browser-side request helper. Centralizes the resilience the public
// pages need when 500+ people hit the site during a launch window:
//   - a hard timeout via AbortController (a hung request never leaves the user
//     staring at a spinner forever),
//   - bounded retry-with-backoff for TRANSIENT failures only (network drop,
//     429 rate-limited, 502/503/504 from a cold or overloaded function),
//   - Retry-After header respect so we back off exactly as long as the server asks,
//   - defensive JSON parsing that never throws the cryptic "Unexpected end of
//     JSON input" at the UI.
//
// Retries are OPT-IN per call (`retries` option) and callers must only enable
// them for idempotent requests. Creating a registration or a Razorpay order is
// NOT idempotent, so those are sent with retries: 0 — a network blip must not
// silently create two rows or two orders.

import { apiUrl } from './apiBase.js'

const DEFAULT_TIMEOUT_MS = 15000

class ApiError extends Error {
  constructor(message, { status = 0, retryAfter = 0 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Parse a Response as JSON without throwing on an empty/non-JSON body.
async function parseJson(res) {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Statuses worth retrying: transient server / gateway failures only. 429 is
// deliberately EXCLUDED — a rate-limit response means "you are already sending
// too fast," so retrying into it amplifies load and burns the caller's own
// window. 429 is surfaced to the UI (via status) as a clear "slow down" message.
function isRetriableStatus(status) {
  return status === 502 || status === 503 || status === 504
}

function retryAfterSeconds(res) {
  const header = res.headers?.get?.('retry-after')
  const n = Number(header)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Fetch JSON with a timeout and optional transient-failure retries.
 *
 * @param {string} path
 * @param {object} [options]
 * @param {string} [options.method]        HTTP method. Default GET.
 * @param {object} [options.body]          JSON-serialized automatically if present.
 * @param {object} [options.headers]
 * @param {number} [options.timeoutMs]     Abort after this long. Default 15s.
 * @param {number} [options.retries]       Transient-failure retries. Default 0 (safe for writes).
 * @param {number} [options.backoffMs]     Base backoff between retries. Default 400ms.
 * @param {AbortSignal} [options.signal]   Caller signal, merged with the timeout signal.
 * @returns {Promise<{status:number, ok:boolean, data:any}>}
 * @throws {ApiError} on network failure / timeout after exhausting retries.
 */
export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    backoffMs = 400,
    signal: callerSignal,
  } = options

  const init = {
    method,
    headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
  }
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body)

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Abort our request if the caller aborts theirs (e.g. component unmount).
    const onCallerAbort = () => controller.abort()
    callerSignal?.addEventListener?.('abort', onCallerAbort)

    let res
    try {
      res = await fetch(apiUrl(path), { ...init, signal: controller.signal })
    } catch {
      // Network failure or timeout abort. Retry if attempts remain.
      lastError = new ApiError(
        controller.signal.aborted && !callerSignal?.aborted
          ? 'The request timed out. Please check your connection and try again.'
          : 'Network error. Please check your connection and try again.',
        { status: 0 },
      )
      if (attempt < retries && !callerSignal?.aborted) {
        await sleep(backoffMs * 2 ** attempt)
        continue
      }
      throw lastError
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener?.('abort', onCallerAbort)
    }

    // Retriable transient status with attempts left: honor Retry-After, else backoff.
    if (isRetriableStatus(res.status) && attempt < retries) {
      // Release the abandoned response stream so the browser can reuse the
      // socket instead of holding it open until GC — matters under a spike when
      // 502/503 retries are most likely.
      res.body?.cancel?.().catch(() => {})
      const ra = retryAfterSeconds(res)
      await sleep(ra > 0 ? ra * 1000 : backoffMs * 2 ** attempt)
      continue
    }

    const data = await parseJson(res)
    return {
      status: res.status,
      ok: res.ok && data?.ok === true,
      retryAfter: retryAfterSeconds(res),
      data: data ?? {
        ok: false,
        error: res.ok
          ? 'Server returned an empty response. Please try again.'
          : 'The service is unavailable right now. Please try again shortly.',
      },
    }
  }

  throw lastError || new ApiError('Request failed.', { status: 0 })
}

export { ApiError }
