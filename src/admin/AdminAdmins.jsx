import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getAdminName, getToken, isSuperAdmin } from './api'
import { Alert, Button, Card, EmptyState, Field, Input, Label, RefreshBar } from './ui'

// Superadmin account management: who can sign in, at what level, and how many
// passes each of them has scanned.
//
// The server owns every rule that matters (last-superadmin protection,
// self-demotion refusal, password length). This screen surfaces the resulting
// error rather than duplicating the logic, so the two can never disagree.

const ROLE_LABELS = { admin: 'Gate admin', superadmin: 'Superadmin' }

function fmtDateTime(value) {
  if (!value) return 'Never'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

const EMPTY_FORM = { username: '', password: '', displayName: '', role: 'admin' }

export default function AdminAdmins() {
  const navigate = useNavigate()
  const [admins, setAdmins] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminFetch('/api/admin/admins')
    if (res.ok) setAdmins(res.data.admins ?? [])
    setError(res.ok ? '' : res.data.error || 'Could not load admins.')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    load()
  }, [navigate, load])

  async function onCreate(event) {
    event.preventDefault()
    setCreating(true)
    setError('')
    setNotice('')
    const res = await adminFetch('/api/admin/admins', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setNotice(`Created ${res.data.admin.username}.`)
      setForm(EMPTY_FORM)
      await load()
    } else {
      setError(res.data.error || 'Could not create the admin.')
    }
    setCreating(false)
  }

  async function patch(body, successMessage) {
    setBusyId(body.id)
    setError('')
    setNotice('')
    const res = await adminFetch('/api/admin/admins', { method: 'PATCH', body: JSON.stringify(body) })
    if (res.ok) {
      setNotice(successMessage)
      await load()
    } else {
      setError(res.data.error || 'Could not update the admin.')
    }
    setBusyId('')
  }

  function onToggleActive(admin) {
    const next = !admin.is_active
    if (!next && !window.confirm(`Deactivate ${admin.username}? They will not be able to sign in.`)) return
    patch({ id: admin.id, isActive: next }, `${admin.username} ${next ? 'reactivated' : 'deactivated'}.`)
  }

  function onToggleRole(admin) {
    const next = admin.role === 'superadmin' ? 'admin' : 'superadmin'
    if (!window.confirm(`Change ${admin.username} to ${ROLE_LABELS[next]}?`)) return
    patch({ id: admin.id, role: next }, `${admin.username} is now ${ROLE_LABELS[next]}.`)
  }

  function onResetPassword(admin) {
    // window.prompt keeps the typed password out of component state and out of
    // any re-render, so it never lands in a React DevTools snapshot.
    const password = window.prompt(`New password for ${admin.username} (at least 8 characters):`)
    if (password === null) return
    patch({ id: admin.id, password }, `Password updated for ${admin.username}.`)
  }

  if (!isSuperAdmin()) {
    return <Alert>This screen is available to superadmins only.</Alert>
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="warn">{notice}</Alert>}

      <RefreshBar left={`${admins.length} accounts`} refreshedAt={refreshedAt} loading={loading} onRefresh={load} />

      <Card className="p-5">
        <Label>Add an admin</Label>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <Field id="new-username" label="Username" hint="Lowercase letters, numbers, dot, dash or underscore.">
            <Input
              id="new-username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="off"
              required
            />
          </Field>
          <Field id="new-display" label="Display name" hint="Recorded on every pass this admin scans.">
            <Input
              id="new-display"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              autoComplete="off"
              required
            />
          </Field>
          <Field id="new-password" label="Password" hint="At least 8 characters.">
            <Input
              id="new-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field id="new-role" label="Role" hint="Superadmins also see the activity log and statistics.">
            <div className="flex gap-2">
              {['admin', 'superadmin'].map((role) => (
                <Button
                  key={role}
                  variant={form.role === role ? 'primary' : 'subtle'}
                  onClick={() => setForm({ ...form, role })}
                >
                  {ROLE_LABELS[role]}
                </Button>
              ))}
            </div>
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create admin'}
            </Button>
          </div>
        </form>
      </Card>

      {admins.length === 0 ? (
        <Card className="p-2">
          <EmptyState>{loading ? 'Loading admins…' : 'No admin accounts yet.'}</EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {admins.map((admin) => (
            <AdminRow
              key={admin.id}
              admin={admin}
              busy={busyId === admin.id}
              isSelf={admin.display_name === getAdminName()}
              onToggleActive={() => onToggleActive(admin)}
              onToggleRole={() => onToggleRole(admin)}
              onResetPassword={() => onResetPassword(admin)}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function AdminRow({ admin, busy, isSelf, onToggleActive, onToggleRole, onResetPassword }) {
  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-paper">{admin.username}</span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              admin.role === 'superadmin'
                ? 'border-red/30 bg-red/10 text-red'
                : 'border-white/10 bg-white/[0.04] text-paper/60'
            }`}
          >
            {ROLE_LABELS[admin.role] || admin.role}
          </span>
          {!admin.is_active && (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
              deactivated
            </span>
          )}
          {isSelf && <span className="text-[11px] text-paper/35">you</span>}
        </div>
        <p className="truncate text-sm text-paper/60">{admin.display_name}</p>
        <p className="text-xs tabular-nums text-paper/35">
          {admin.scans ?? 0} scans · last sign-in {fmtDateTime(admin.last_login_at)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onResetPassword} disabled={busy}>
          Reset password
        </Button>
        <Button size="sm" onClick={onToggleRole} disabled={busy}>
          {admin.role === 'superadmin' ? 'Make gate admin' : 'Make superadmin'}
        </Button>
        <Button size="sm" variant={admin.is_active ? 'danger' : 'subtle'} onClick={onToggleActive} disabled={busy}>
          {admin.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    </div>
  )
}
