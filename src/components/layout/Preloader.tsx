import { useEffect, useState } from 'react'
import logo from '../../assets/brand/logo-wordmark-white.png'

type Phase = 'visible' | 'logoOut' | 'bgOut' | 'done'

const HOLD_MS = 650
const LOGO_OUT_MS = 300
const BG_OUT_MS = 700

export function Preloader() {
  const [phase, setPhase] = useState<Phase>('visible')

  useEffect(() => {
    // Sequenced, not simultaneous: the logo fully disappears first, and
    // only then does the background start sliding apart — otherwise there's
    // a window where the halves have parted but the (now-invisible) logo is
    // still just sitting there, static, reading as a glitch.
    const t1 = window.setTimeout(() => setPhase('logoOut'), HOLD_MS)
    const t2 = window.setTimeout(() => setPhase('bgOut'), HOLD_MS + LOGO_OUT_MS)
    const t3 = window.setTimeout(() => setPhase('done'), HOLD_MS + LOGO_OUT_MS + BG_OUT_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [])

  if (phase === 'done') return null

  const logoGone = phase === 'logoOut' || phase === 'bgOut'
  const bgOut = phase === 'bgOut'

  return (
    <div className="fixed inset-0 z-[200]" aria-hidden="true">
      <div
        className={`absolute inset-x-0 top-0 h-1/2 bg-brand-500 transition-transform ease-[cubic-bezier(0.76,0,0.24,1)] ${
          bgOut ? '-translate-y-full' : 'translate-y-0'
        }`}
        style={{ transitionDuration: `${BG_OUT_MS}ms` }}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 bg-brand-500 transition-transform ease-[cubic-bezier(0.76,0,0.24,1)] ${
          bgOut ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{ transitionDuration: `${BG_OUT_MS}ms` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={logo}
          alt="Edelicacies"
          className={`animate-fade-in-up h-20 w-auto transition-all ease-out ${
            logoGone ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
          }`}
          style={{ transitionDuration: `${LOGO_OUT_MS}ms` }}
        />
      </div>
    </div>
  )
}
