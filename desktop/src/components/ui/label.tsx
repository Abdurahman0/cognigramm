import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-muted-foreground text-[13px] font-medium select-none peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
