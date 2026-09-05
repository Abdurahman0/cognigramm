import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        muted: 'bg-secondary text-secondary-foreground',
        success: 'bg-success text-white',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      size: {
        default: 'h-5 min-w-5 px-1.5',
        sm: 'h-4 min-w-4 px-1',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Badge({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
