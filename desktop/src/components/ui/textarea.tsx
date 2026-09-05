import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'text-foreground placeholder:text-faint-foreground w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
