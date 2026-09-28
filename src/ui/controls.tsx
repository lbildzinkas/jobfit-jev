import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>
    </section>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'error'
  children: ReactNode
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-md border px-3 py-2 text-sm ${noticeTones[tone]}`}
    >
      {children}
    </p>
  )
}

export const inputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
}

const buttonBase =
  'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50'

const buttonVariants = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100',
  danger: 'bg-red-700 text-white hover:bg-red-600',
  link: 'px-0 py-0 text-slate-700 underline hover:text-slate-900',
}

const noticeTones = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-red-300 bg-red-50 text-red-900',
}
