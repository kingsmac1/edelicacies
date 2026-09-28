import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { unsubscribeById } from '../lib/api/subscribers'

export function Unsubscribe() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working')

  useEffect(() => {
    if (!id) {
      setStatus('error')
      return
    }
    unsubscribeById(id)
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'))
  }, [id])

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      {status === 'working' && <p className="text-[15px] text-ink-400">Unsubscribing…</p>}
      {status === 'done' && (
        <>
          <h1 className="text-xl font-semibold text-ink-800">You're unsubscribed</h1>
          <p className="mt-2 text-[15px] text-ink-400">
            You won't get any more "menu is live" emails from us. Come back any time!
          </p>
        </>
      )}
      {status === 'error' && (
        <p className="text-[15px] text-ink-400">
          We couldn't process that — the link may be invalid.
        </p>
      )}
    </div>
  )
}
