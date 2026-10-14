import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ownerHasPin, saveOwnerPin } from '../../lib/api/ownerAssistant'
import {
  addOwnerNumber,
  confirmOwnerNumber,
  fetchAdminLog,
  fetchOwnerNumbers,
  friendlyOwnerNumberError,
  removeOwnerNumber,
  renameOwnerNumber,
  sendOwnerNumberCode,
  type AdminLogRow,
  type OwnerNumber,
} from '../../lib/api/ownerNumbers'

const inputClass =
  'min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500'

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function OwnerPinCard() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    void ownerHasPin().then(setHasPin)
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const r = await saveOwnerPin(next, hasPin ? current : undefined)
      if (r === 'ok') {
        setMsg({ kind: 'ok', text: hasPin ? 'PIN changed.' : 'PIN saved.' })
        setHasPin(true)
        setCurrent('')
        setNext('')
      } else if (r === 'locked') {
        setMsg({ kind: 'error', text: 'Too many wrong tries. Please wait 15 minutes and try again.' })
      } else {
        setMsg({ kind: 'error', text: 'Your current PIN is not right.' })
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save the PIN.' })
    } finally {
      setBusy(false)
    }
  }

  const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 6)

  return (
    <form onSubmit={save} className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
      <h2 className="text-[15px] font-semibold text-ink-800">Owner PIN</h2>
      <p className="mt-1 text-[13px] text-ink-500">
        Risky changes in the owner assistant (many prices at once, or a big price jump) ask for this PIN instead of a
        simple YES. Even someone using your open laptop cannot do them without it.{' '}
        {hasPin === null ? '' : hasPin ? 'A PIN is set.' : 'No PIN is set yet, so those changes are blocked until you set one.'}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {hasPin && (
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Current PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              className="min-h-11 w-32 rounded-xl border border-ink-100 px-3 text-center tracking-[0.4em]"
              value={current}
              onChange={(e) => setCurrent(digitsOnly(e.target.value))}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-ink-700">{hasPin ? 'New PIN' : 'Choose a PIN'} (4 to 6 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="min-h-11 w-40 rounded-xl border border-ink-100 px-3 text-center tracking-[0.4em]"
            value={next}
            onChange={(e) => setNext(digitsOnly(e.target.value))}
          />
        </label>
        <Button type="submit" disabled={busy || next.length < 4 || (hasPin === true && current.length < 4)}>
          {hasPin ? 'Change PIN' : 'Save PIN'}
        </Button>
      </div>
      {msg && (
        <p className={`mt-3 text-[13px] font-medium ${msg.kind === 'ok' ? 'text-emerald-700' : 'text-brand-600'}`}>{msg.text}</p>
      )}
    </form>
  )
}

export function OwnerOwnerNumbers() {
  const [numbers, setNumbers] = useState<OwnerNumber[]>([])
  const [log, setLog] = useState<AdminLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'remove'; n: OwnerNumber } | null>(null)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    try {
      const [n, l] = await Promise.all([fetchOwnerNumbers(), fetchAdminLog(30)])
      setNumbers(n)
      setLog(l)
    } catch {
      setMessage({ kind: 'error', text: 'Could not load. Please run the latest SQL (Phase 7) and refresh.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>, okText?: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      if (okText) setMessage({ kind: 'ok', text: okText })
      await load()
    } catch (err) {
      setMessage({ kind: 'error', text: friendlyOwnerNumberError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Owner numbers</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Phone numbers allowed to run the business from WhatsApp: add orders, change the menu, approve orders and ask
        about sales. Anyone else gets the normal customer assistant, even if they say they are the owner.
      </p>

      {message && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-[14px] font-medium ${
            message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-50 text-brand-700'
          }`}
        >
          {message.text}
        </p>
      )}

      <OwnerPinCard />

      <form
        className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-ink-100"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await addOwnerNumber(name, phone)
            setName('')
            setPhone('')
          }, 'Number added. It stays pending until you confirm the code sent to it.')
        }}
      >
        <h2 className="text-[15px] font-semibold text-ink-800">Add a number</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Name</span>
            <input className={inputClass} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Macauley" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">WhatsApp number</span>
            <input
              className={inputClass}
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0801 234 5678"
            />
          </label>
        </div>
        <p className="mt-2 text-[12px] text-ink-400">
          Use your personal number, not the Edelicacies business number. You can register up to 5.
        </p>
        <div className="mt-3">
          <Button type="submit" disabled={busy || !name.trim() || !phone.trim()}>
            Add number
          </Button>
        </div>
      </form>

      <section className="mt-5">
        {loading ? (
          <p className="text-[14px] text-ink-400">Loading…</p>
        ) : numbers.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-[14px] text-ink-400 ring-1 ring-ink-100">
            No owner numbers yet.
          </p>
        ) : (
          <div className="space-y-3">
            {numbers.map((n) => (
              <div key={n.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink-800">{n.name}</p>
                    <p className="text-[13px] text-ink-500">+{n.phone}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      n.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {n.status === 'active' ? 'Active' : 'Pending: not confirmed yet'}
                  </span>
                </div>

                {n.status === 'pending' && (
                  <div className="mt-3 rounded-xl bg-ink-50 p-3">
                    <p className="text-[13px] text-ink-600">
                      Send a code to this number on WhatsApp, then type it here to activate it.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void run(() => sendOwnerNumberCode(n.id), 'Code sent. Check that phone.')}
                      >
                        Send code
                      </Button>
                      <input
                        className="min-h-11 w-32 rounded-xl border border-ink-100 px-3 text-[14px] tracking-widest"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={codes[n.id] ?? ''}
                        onChange={(e) => setCodes({ ...codes, [n.id]: e.target.value.replace(/\D/g, '') })}
                      />
                      <Button
                        disabled={busy || (codes[n.id] ?? '').length !== 6}
                        onClick={() =>
                          void run(async () => {
                            const ok = await confirmOwnerNumber(n.id, codes[n.id] ?? '')
                            if (!ok) throw new Error('That code is not right. Please check it and try again.')
                          }, 'Number confirmed. It can now use the owner tools.')
                        }
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setNewName(n.name)
                      setDialog({ kind: 'rename', n })
                    }}
                  >
                    Rename
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setDialog({ kind: 'remove', n })}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button aria-label="Close" onClick={() => setDialog(null)} className="absolute inset-0 bg-ink-900/50" />
          <div
            role="dialog"
            aria-modal="true"
            className="animate-pop-in relative w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            {dialog.kind === 'rename' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const n = dialog.n
                  setDialog(null)
                  if (newName.trim() && newName.trim() !== n.name) {
                    void run(() => renameOwnerNumber(n.id, newName), 'Name updated.')
                  }
                }}
              >
                <h3 className="text-lg font-medium text-ink-800">Rename this number</h3>
                <p className="mt-1 text-[13px] text-ink-400">+{dialog.n.phone}</p>
                <input
                  autoFocus
                  className={`${inputClass} mt-4`}
                  value={newName}
                  maxLength={60}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newName.trim()}>
                    Save name
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-ink-800">Remove {dialog.n.name}?</h3>
                <p className="mt-2 text-[14px] text-ink-500">
                  +{dialog.n.phone} will no longer be able to use the owner tools. You can add it again later, and it
                  will need a new confirmation code.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDialog(null)}>
                    Keep it
                  </Button>
                  <Button
                    onClick={() => {
                      const n = dialog.n
                      setDialog(null)
                      void run(() => removeOwnerNumber(n.id), 'Number removed.')
                    }}
                  >
                    Remove number
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink-800">Recent owner actions</h2>
        <p className="text-[13px] text-ink-400">
          Changes to this list. Everything else the owner assistant does is in the{' '}
          <a href="/dashboard/activity" className="font-semibold text-brand-600 underline">
            Activity log
          </a>
          .
        </p>
        {log.length === 0 ? (
          <p className="mt-3 text-[14px] text-ink-400">Nothing yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {log.map((r) => (
              <li key={r.id} className="rounded-xl bg-white px-4 py-2.5 text-[13px] text-ink-700 ring-1 ring-ink-100">
                <span className="text-ink-400">{when(r.created_at)}</span> · {r.summary}
                <span className="block text-[12px] text-ink-400">{r.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
