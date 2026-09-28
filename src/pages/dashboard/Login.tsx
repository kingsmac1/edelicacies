import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import logo from '../../assets/brand/logo-wordmark.png'

export function OwnerLogin() {
  const { session, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/dashboard" replace />

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-semibold text-ink-800">Dashboard not connected yet</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-400">
          Add your Supabase project URL and anon key to the <code>.env</code> file, and paste{' '}
          <code>supabase/schema.sql</code> into the Supabase SQL Editor. See SETUP.md for the full
          steps.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <img src={logo} alt="Edelicacies" className="mx-auto h-9 w-auto" />
      <h1 className="mt-6 text-center text-xl font-semibold text-ink-800">Owner login</h1>
      <p className="mt-1 text-center text-[14px] text-ink-400">Sign in to manage your menu and orders.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          required
          type="email"
          autoComplete="username"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 rounded-xl border border-ink-100 bg-white px-4 text-[15px] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          required
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-12 rounded-xl border border-ink-100 bg-white px-4 text-[15px] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p className="text-[13px] font-medium text-brand-600">{error}</p>}
        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
