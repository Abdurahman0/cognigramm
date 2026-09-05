import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'bg-input text-foreground h-10 w-full min-w-0 rounded-lg px-3 py-2 text-sm shadow-[inset_0_0_0_0.5px_var(--glass-border)] transition-[box-shadow,background-color] outline-none',
        'placeholder:text-faint-foreground',
        'focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]',
        className,
      )}
      {...props}
    />
  )
}
