import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark'
  size?: 'md' | 'lg'
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        size === 'md' ? 'min-h-11 px-5 text-[15px]' : 'min-h-12 px-6 text-base',
        variant === 'primary' &&
          'bg-brand-500 text-white shadow-sm shadow-brand-500/30 hover:bg-brand-600',
        variant === 'secondary' &&
          'bg-brand-50 text-brand-600 hover:bg-brand-100',
        variant === 'ghost' && 'bg-transparent text-ink-700 hover:bg-ink-50',
        variant === 'dark' && 'bg-ink-900 text-white hover:bg-ink-700',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
