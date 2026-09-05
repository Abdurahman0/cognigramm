import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useEffect } from 'react'
import { create } from 'zustand'

import { cn } from '@/lib/utils'

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
  /** Milliseconds; `null` keeps it up until dismissed. */
  duration: number | null
}

interface ToastState {
  toasts: ToastItem[]
  push: (
    toast: Omit<ToastItem, 'id' | 'tone' | 'duration'> &
      Partial<Pick<ToastItem, 'tone' | 'duration'>>,
  ) => string
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, tone: 'info', duration: 4_500, ...toast }],
    }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

/** Imperative API, callable from stores and event handlers as well as components. */
export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'error', duration: 7_000 }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}

const ICONS: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
}

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'text-primary',
  success: 'text-success',
  error: 'text-destructive',
}

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const Icon = ICONS[item.tone]

  useEffect(() => {
    if (item.duration === null) return
    const timer = setTimeout(() => dismiss(item.id), item.duration)
    return () => clearTimeout(timer)
  }, [item.duration, item.id, dismiss])

  return (
    <div
      role="status"
      className="glass-floating bg-popover text-popover-foreground animate-in slide-in-from-bottom-2 fade-in-0 pointer-events-auto flex w-80 items-start gap-3 rounded-xl p-3"
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_CLASS[item.tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description ? (
          <p className="text-muted-foreground mt-0.5 text-[13px] break-words">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full p-0.5 transition"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  )
}
