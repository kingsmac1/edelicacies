import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { unsubscribeById, unsubscribeCustomerById } from '../lib/api/subscribers'

export function Unsubscribe() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const customerId = params.get('c')
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working')

  useEffect(() => {
    const target = customerId ?? id
    if (!target) {
      setStatus('error')
      return
    }
    const run = customerId ? unsubscribeCustomerById : unsubscribeById
    run(target)
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'))
  }, [id, customerId])

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      {status === 'working' && <p className="text-[15px] text-ink-400">Unsubscribing…</p>}
      {status === 'done' && (
        <>
          <h1 className="text-xl font-semibold text-ink-800">You're unsubscribed</h1>
          <p className="mt-2 text-[15px] text-ink-400">
            You won't get any more promotional emails from us. You'll still get emails about orders you place. Come back any time!
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
