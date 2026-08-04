// Regression cover for adminFetch's request encoding.
//
// The bug this guards: every admin POST goes out as Content-Type
// application/json, but the wrapper handed fetch whatever `body` the caller
// passed. Three call sites in the verification queue passed a plain object, so
// fetch stringified it as "[object Object]" and the server's JSON body parser
// answered 400 before any route ran — the dashboard's Approve, Reject and
// Resend buttons all failed with a bare "400 Bad Request" in the console.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { adminFetch } from '../admin/api.js'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => JSON.stringify({ ok: true }),
  })
  global.fetch = fetchMock
  sessionStorage.setItem('tedx_admin_token', 'test-token')
})

function sentBody() {
  return fetchMock.mock.calls[0][1].body
}

describe('adminFetch body encoding', () => {
  it('serializes a plain object body as JSON — never "[object Object]"', async () => {
    await adminFetch('/api/admin/verifications', {
      method: 'POST',
      body: { registrationId: 'reg-1', reject: true, reason: 'UTR not in statement' },
    })

    const body = sentBody()
    expect(typeof body).toBe('string')
    expect(body).not.toContain('[object Object]')
    expect(JSON.parse(body)).toEqual({
      registrationId: 'reg-1',
      reject: true,
      reason: 'UTR not in statement',
    })
  })

  it('leaves an already-stringified body alone (no double encoding)', async () => {
    await adminFetch('/api/admin/checkin', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc' }),
    })

    const body = sentBody()
    expect(body).toBe('{"token":"abc"}')
    // Double-encoding would yield a JSON string, not an object.
    expect(JSON.parse(body)).toEqual({ token: 'abc' })
  })

  it('sends no body on a GET', async () => {
    await adminFetch('/api/admin/verifications')
    expect(sentBody()).toBeUndefined()
  })

  it('passes FormData through untouched so the browser can set its own boundary', async () => {
    const form = new FormData()
    form.append('file', 'x')
    await adminFetch('/api/admin/upload', { method: 'POST', body: form })
    expect(sentBody()).toBe(form)
  })

  it('still sends the bearer token and JSON content type', async () => {
    await adminFetch('/api/admin/verifications', { method: 'POST', body: { registrationId: 'r' } })
    const { headers } = fetchMock.mock.calls[0][1]
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(headers['Content-Type']).toBe('application/json')
  })
})
