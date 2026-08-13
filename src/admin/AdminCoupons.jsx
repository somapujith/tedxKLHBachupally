import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Alert, Button, Card, CardHeader, EmptyState, Field, Input, RefreshBar } from './ui'

// Superadmin discount coupons: define a code, the rupees it takes off, and see
// how many buyers have used it.
//
// The server owns every rule that matters (code format, duplicate codes, the
// ₹1 floor, refusing to delete a redeemed coupon). This screen surfaces the
// resulting error rather than re-implementing the logic, so the two can never
// disagree about what is allowed.

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

const EMPTY_FORM = { code: '', discountAmount: '' }

export default function AdminCoupons() {
  const navigate = useNavigate()
  const [coupons, setCoupons] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminFetch('/api/admin/coupons')
    if (res.ok) setCoupons(res.data.coupons ?? [])
    setError(res.ok ? '' : res.data.error || 'Could not load coupons.')
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
    const res = await adminFetch('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setNotice(`Created ${res.data.coupon.code} (−₹${res.data.coupon.discount_amount}).`)
      setForm(EMPTY_FORM)
      await load()
    } else {
      setError(res.data.error || 'Could not create the coupon.')
    }
    setCreating(false)
  }

  async function patch(body, successMessage, failMessage) {
    setBusyId(body.id)
    setError('')
    setNotice('')
    const res = await adminFetch('/api/admin/coupons', { method: 'PATCH', body: JSON.stringify(body) })
    if (res.ok) {
      setNotice(successMessage)
      await load()
    } else {
      setError(res.data.error || failMessage)
    }
    setBusyId('')
  }

  function onToggleActive(coupon) {
    const next = !coupon.is_active
    if (
      !next &&
      !window.confirm(`Switch off ${coupon.code}? Buyers entering it will be told it is not valid.`)
    ) {
      return
    }
    patch(
      { id: coupon.id, isActive: next },
      `${coupon.code} ${next ? 'activated' : 'deactivated'}.`,
      'Could not update the coupon.',
    )
  }

  function onEditDiscount(coupon) {
    const entered = window.prompt(`New discount for ${coupon.code}, in rupees:`, String(coupon.discount_amount))
    if (entered === null) return
    patch(
      { id: coupon.id, discountAmount: entered.trim() },
      `${coupon.code} discount updated.`,
      'Could not update the discount.',
    )
  }

  // Delete rides on PATCH with `delete: true`. The Vercel admin dispatcher
  // shares one method allowlist across every admin resource, so adding a DELETE
  // verb for this one screen would hand a delete verb to all of them.
  function onDelete(coupon) {
    if (!window.confirm(`Delete ${coupon.code}? This cannot be undone.`)) return
    patch({ id: coupon.id, delete: true }, `${coupon.code} deleted.`, 'Could not delete the coupon.')
  }

  if (!isSuperAdmin()) {
    return <Alert>This screen is available to superadmins only.</Alert>
  }

  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.times_used || 0), 0)

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="warn">{notice}</Alert>}

      <RefreshBar
        left={`${coupons.length} coupons · ${totalRedemptions} used`}
        refreshedAt={refreshedAt}
        loading={loading}
        onRefresh={load}
      />

      <Card>
        <CardHeader title="Create a coupon" meta="Takes a flat amount off the current pass price." />
        <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
          <Field id="coupon-code" label="Code" hint="3–24 letters or numbers. Buyers can type it in any case.">
            <Input
              id="coupon-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="SAVE100"
              autoComplete="off"
              required
            />
          </Field>
          <Field
            id="coupon-discount"
            label="Discount (₹)"
            hint="Subtracted from the pass price. A pass never costs less than ₹1."
          >
            <Input
              id="coupon-discount"
              type="number"
              min="1"
              step="1"
              value={form.discountAmount}
              onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
              placeholder="100"
              autoComplete="off"
              required
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create coupon'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Coupons" meta="Usage counts every buyer who submitted payment with the code." />
        {coupons.length === 0 ? (
          <EmptyState hint="Create one above to offer a discount at checkout.">No coupons yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => {
              const busy = busyId === coupon.id
              return (
                <div
                  key={coupon.id}
                  className="flex flex-col gap-3 border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base tracking-wider">{coupon.code}</span>
                      <span
                        className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                          coupon.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {coupon.is_active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm text-white/70">
                      −₹{coupon.discount_amount} off ·{' '}
                      <span className="text-white">
                        used {coupon.times_used} {coupon.times_used === 1 ? 'time' : 'times'}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-white/40">
                      Created {fmtDateTime(coupon.created_at)}
                      {coupon.created_by ? ` by ${coupon.created_by}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" onClick={() => onEditDiscount(coupon)} disabled={busy}>
                      Edit amount
                    </Button>
                    <Button size="sm" onClick={() => onToggleActive(coupon)} disabled={busy}>
                      {coupon.is_active ? 'Switch off' : 'Switch on'}
                    </Button>
                    {/* Deleting a redeemed coupon would destroy the record of why
                        those buyers paid less, so the server refuses it. Hiding
                        the button keeps the screen honest about what is possible
                        instead of offering an action that always errors. */}
                    {coupon.times_used === 0 && (
                      <Button size="sm" onClick={() => onDelete(coupon)} disabled={busy}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
