import { useEffect, useState } from 'react'
import logo from '../../assets/brand/logo-wordmark-white.png'

type Phase = 'visible' | 'exiting' | 'done'

const HOLD_MS = 650
const EXIT_MS = 850

export function Preloader() {
  const [phase, setPhase] = useState<Phase>('visible')

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setPhase('exiting'), HOLD_MS)
    const doneTimer = window.setTimeout(() => setPhase('done'), HOLD_MS + EXIT_MS)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  if (phase === 'done') return null

  const exiting = phase === 'exiting'

  return (
    <div className="fixed inset-0 z-[200]" aria-hidden="true">
      <div
        className={`absolute inset-x-0 top-0 h-1/2 bg-brand-500 transition-transform ease-[cubic-bezier(0.76,0,0.24,1)] ${
          exiting ? '-translate-y-full' : 'translate-y-0'
        }`}
        style={{ transitionDuration: `${EXIT_MS}ms` }}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 bg-brand-500 transition-transform ease-[cubic-bezier(0.76,0,0.24,1)] ${
          exiting ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{ transitionDuration: `${EXIT_MS}ms` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={logo}
          alt="Edelicacies"
          className={`animate-fade-in-up h-14 w-auto transition-all duration-500 ease-out ${
            exiting ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
          }`}
        />
      </div>
    </div>
  )
}
