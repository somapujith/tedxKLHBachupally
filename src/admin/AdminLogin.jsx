import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eyebrow, Button } from '../components/ui'
import { getToken, login } from './api'

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
    <div className="min-h-screen bg-ink text-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm border border-paper/15 bg-paper/[0.02] p-8">
        <Eyebrow className="mb-3">TEDxKLH Bachupally · Admin</Eyebrow>
        <h1 className="mb-8 font-display text-3xl tracking-tight">Sign in.</h1>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <LoginField
            id="admin-username"
            label="Username"
            value={form.username}
            autoComplete="username"
            onChange={(v) => update('username', v)}
          />
          <LoginField
            id="admin-password"
            label="Password"
            type="password"
            value={form.password}
            autoComplete="current-password"
            onChange={(v) => update('password', v)}
          />

          {error && (
            <p role="alert" className="border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="w-full !font-montserrat text-[11px] font-medium !tracking-[0.2em]"
          >
            {submitting ? 'Signing in…' : 'Sign in →'}
          </Button>
        </form>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/35">
          Authorized crew only
        </p>
      </div>
    </div>
  )
}

function LoginField({ id, label, value, onChange, type = 'text', autoComplete }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 text-paper transition-colors focus:border-red focus:outline-none"
      />
    </div>
  )
}
