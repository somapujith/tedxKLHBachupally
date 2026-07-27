// Admin API helpers — sessionStorage token store + defensive fetch wrapper.
// All admin endpoints may return non-JSON on a crash, so parsing never throws
// raw JSON errors at the UI; it degrades to a clean {ok:false, error} shape.

import { apiUrl } from '../lib/apiBase.js'

const TOKEN_KEY = 'tedx_admin_token'
const NAME_KEY = 'tedx_admin_name'

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function getAdminName() {
  return sessionStorage.getItem(NAME_KEY) || 'Admin'
}

function setSession(token, displayName) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(NAME_KEY, displayName)
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(NAME_KEY)
}

// Parse a Response body as JSON without ever throwing "Unexpected end of
// JSON input" — mirrors the readJson pattern in pages/Register.jsx.
async function readJson(res) {
  const text = await res.text().catch(() => '')
  if (!text) {
    return { ok: false, error: 'The admin service is unavailable right now. Please try again.' }
  }
  try {
    return JSON.parse(text)
  } catch {
    return { ok: false, error: 'Server returned an invalid response. Please try again.' }
  }
}

// Authenticated fetch for /api/admin/*. Injects the Bearer token, parses the
// body defensively and returns { status, ok, data } so callers can branch on
// specific statuses (e.g. 409 already-checked-in). A 401 clears the session
// and bounces to the login screen.
export async function adminFetch(path, options = {}) {
  let res
  try {
    res = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...(options.headers || {}),
      },
    })
  } catch {
    return { status: 0, ok: false, data: { ok: false, error: 'Network error. Check your connection.' } }
  }

  if (res.status === 401) {
    clearSession()
    window.location.assign('/admin/login')
    return { status: 401, ok: false, data: { ok: false, error: 'Session expired. Sign in again.' } }
  }

  const data = await readJson(res)
  return { status: res.status, ok: res.ok && data.ok === true, data }
}

export async function login(username, password) {
  const res = await fetch(apiUrl('/api/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await readJson(res)
  if (!res.ok || !data.ok || !data.token) {
    throw new Error(data.error || 'Invalid username or password.')
  }
  setSession(data.token, data.admin?.displayName || data.admin?.username || 'Admin')
  return data.admin
}

export function logout() {
  clearSession()
}
