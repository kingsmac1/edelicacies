import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'

// Passwordless sign-in: type your email, get a 6-digit code, type it back.
// The first time someone does this, their account is created automatically.
export function LoginCodeForm({
  initialEmail = '',
  onSignedIn,
}: {
  initialEmail?: string
  onSignedIn?: () => void
}) {
  const { sendLoginCode, verifyLoginCode } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSend(e?: FormEvent) {
    e?.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await sendLoginCode(email)
    setBusy(false)
    if (error) {
      setError(
        /rate|seconds|too many/i.test(error)
          ? 'Please wait a minute before asking for another code.'
          : "We couldn't send the code. Please check the email address and try again.",
      )
      return
    }
    setStep('code')
    setNotice(`We sent a 6-digit code to ${email.trim()}.`)
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (code.trim().length < 6) {
      setError('Please enter the 6-digit code from the email.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await verifyLoginCode(email, code)
    setBusy(false)
    if (error) {
      setError('That code is not right or has expired. Please check it, or ask for a new one.')
      return
    }
    onSignedIn?.()
  }

  if (step === 'email') {
    return (
      <form onSubmit={handleSend} className="flex flex-col gap-3">
        <input
          required
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 rounded-xl border border-ink-100 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p className="text-[13px] font-medium text-brand-600">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Email me a code'}
        </Button>
        <p className="text-[12px] text-ink-400">No password needed. We'll email you a 6-digit code.</p>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-3">
      {notice && (
        <p className="text-[13px] text-ink-500">
          {notice} It can take a minute to arrive. Check your spam folder too.
        </p>
      )}
      <input
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
        className="min-h-12 rounded-xl border border-ink-100 bg-white px-4 text-center text-[20px] tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {error && <p className="text-[13px] font-medium text-brand-600">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? 'Checking…' : 'Sign in'}
      </Button>
      <button
        type="button"
        onClick={() => {
          setStep('email')
          setCode('')
          setError(null)
        }}
        className="text-[13px] font-medium text-ink-500 underline"
      >
        Use a different email or send a new code
      </button>
    </form>
  )
}
