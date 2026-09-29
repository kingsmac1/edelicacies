import type { ReactNode } from 'react'
import { Button } from './Button'

interface SuccessModalProps {
  open: boolean
  title?: string
  message?: string
  onClose: () => void
  /** Extra actions rendered below the default close button, e.g. "Notify subscribers". */
  children?: ReactNode
}

export function SuccessModal({ open, title = 'Saved!', message, onClose, children }: SuccessModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-900/50" />
      <div className="animate-pop-in relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <svg
          className="mx-auto h-16 w-16 text-emerald-500"
          viewBox="0 0 52 52"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="animate-check-circle"
            cx="26"
            cy="26"
            r="25"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            className="animate-check-mark"
            d="M14.1 27.2l7.1 7.2 16.7-16.8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <h3 className="mt-4 text-lg font-semibold text-ink-800">{title}</h3>
        {message && <p className="mt-1.5 text-[14px] text-ink-500">{message}</p>}

        <div className="mt-5 flex flex-col gap-2">
          {children}
          <Button variant="ghost" fullWidth onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
