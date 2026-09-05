import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DeliveryState } from '@/types'

/**
 * Sender-side delivery state.
 *
 * One tick means the server has it, two mean the recipient's client has it,
 * and blue means it was read — the convention every messenger uses, so it
 * needs no legend.
 */
export function DeliveryTicks({ state, className }: { state: DeliveryState; className?: string }) {
  const common = cn('size-3.5 shrink-0', className)

  switch (state) {
    case 'sending':
      return <Clock className={cn(common, 'opacity-60')} aria-label="Sending" />
    case 'sent':
      return <Check className={common} aria-label="Sent" />
    case 'delivered':
      return <CheckCheck className={common} aria-label="Delivered" />
    case 'read':
      return <CheckCheck className={cn(common, 'text-sky-300')} aria-label="Read" />
    case 'failed':
      return <AlertCircle className={cn(common, 'text-destructive')} aria-label="Failed" />
  }
}
