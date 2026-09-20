'use client'

import { forwardRef, InputHTMLAttributes, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon?: ReactNode
  right?: ReactNode
  error?: string
  hint?: string
}

/** Premium form field for sign-in / sign-up: label above, icon inside, clear focus and error states. */
const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField({ label, icon, right, error, hint, id, className, ...props }, ref) {
  const fid = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label htmlFor={fid} className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
        <input
          ref={ref}
          id={fid}
          aria-invalid={!!error}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          className={cn(
            'h-12 w-full rounded-xl border bg-white text-[15px] text-ink outline-none transition-all placeholder:text-gray-400',
            icon ? 'pl-11' : 'pl-4', right ? 'pr-12' : 'pr-4',
            error ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-gray-200 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/10',
            className,
          )}
          {...props}
        />
        {right && <span className="absolute right-2 top-1/2 -translate-y-1/2">{right}</span>}
      </div>
      {error ? (
        <p id={`${fid}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
})

export default AuthField
