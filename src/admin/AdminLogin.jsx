import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, login } from './api'
import { Alert, Button, Card, Field, Input } from './ui'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (getToken()) navigate('/admin', { replace: true })
  }, [navigate])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('Enter your username and password.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await login(form.username, form.password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5 py-12 font-body text-paper">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-red" />
          <span className="text-sm font-semibold tracking-tight">TEDxKLH</span>
          <span className="text-sm text-paper/35">Admin</span>
        </div>

        <Card className="p-6">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-paper/45">Authorized crew only.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field id="admin-username" label="Username">
              <Input
                id="admin-username"
                value={form.username}
                autoComplete="username"
                onChange={(e) => update('username', e.target.value)}
                required
              />
            </Field>

            <Field id="admin-password" label="Password">
              <Input
                id="admin-password"
                type="password"
                value={form.password}
                autoComplete="current-password"
                onChange={(e) => update('password', e.target.value)}
                required
              />
            </Field>

            {error && <Alert>{error}</Alert>}

            <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
