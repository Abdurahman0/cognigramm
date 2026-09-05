import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, LogOut, Monitor, ShieldOff, Smartphone } from 'lucide-react'

import { authApi } from '@/api/endpoints'
import { Badge, Button, Skeleton, Spinner, toast } from '@/components/ui'
import { formatListTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import type { ApiDeviceSession } from '@/api/types'

const sessionsKey = ['auth', 'sessions'] as const

/** The device list has no type field, so the name is the only hint available. */
const iconFor = (deviceName: string) => {
  const name = deviceName.toLowerCase()
  if (/iphone|android|pixel|galaxy|mobile/.test(name)) return Smartphone
  if (/desktop|windows|macos|mac|linux|tauri/.test(name)) return Monitor
  return Laptop
}

const relative = (value: string | null): string => (value ? formatListTime(value) : 'never')

/**
 * Signed-in devices.
 *
 * A refresh token lives up to 180 days, so "where am I signed in" stops being
 * a curiosity and becomes the only way to end a session on a machine the user
 * no longer has. Revoking a row kills its tokens immediately and closes any
 * socket it holds.
 */
export function DeviceSessions() {
  const queryClient = useQueryClient()
  const signOut = useAuthStore((state) => state.signOut)
  const currentSessionId = useAuthStore((state) => state.authSessionId)

  const { data, isPending, isError, error } = useQuery({
    queryKey: sessionsKey,
    queryFn: () => authApi.sessions(),
    staleTime: 30_000,
  })

  const revoke = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: (_result, sessionId) => {
      if (sessionId === currentSessionId) {
        // Revoking this device is a sign-out by another name.
        void signOut('Signed out on this device')
        return
      }
      toast.success('Device signed out')
      void queryClient.invalidateQueries({ queryKey: sessionsKey })
    },
    onError: (mutationError: Error) =>
      toast.error('Could not sign out that device', mutationError.message),
  })

  const logoutAll = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => void signOut('Signed out everywhere'),
    onError: (mutationError: Error) =>
      toast.error('Could not sign out everywhere', mutationError.message),
  })

  const sessions: ApiDeviceSession[] = Array.isArray(data) ? data : []

  return (
    <div className="space-y-2">
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="bg-destructive/12 text-destructive rounded-xl p-3 text-[13px]">
          Could not load your devices: {(error as Error).message}
        </p>
      ) : sessions.length === 0 ? (
        <p className="bg-input/60 text-muted-foreground rounded-xl p-3 text-[13px]">
          No other devices are signed in.
        </p>
      ) : (
        sessions.map((session) => {
          const Icon = iconFor(session.device_name)
          const isCurrent = session.is_current || session.id === currentSessionId
          return (
            <div
              key={session.id}
              className={cn(
                'raised-card flex items-center gap-3 rounded-xl px-3 py-2.5',
                isCurrent && 'shadow-[inset_0_0_0_1px_var(--ring)]',
              )}
            >
              <span className="bg-input grid size-9 shrink-0 place-items-center rounded-full">
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                  {session.device_name || 'Unknown device'}
                  {isCurrent ? <Badge variant="muted">this device</Badge> : null}
                </p>
                <p className="text-muted-foreground truncate text-[12px]">
                  Last active {relative(session.last_used_at)} · signed in{' '}
                  {relative(session.created_at)} · expires {relative(session.expires_at)}
                </p>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/15"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(session.id)}
              >
                {revoke.isPending && revoke.variables === session.id ? (
                  <Spinner />
                ) : (
                  <ShieldOff className="size-4" />
                )}
                {isCurrent ? 'Sign out' : 'Revoke'}
              </Button>
            </div>
          )
        })
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/15"
          disabled={logoutAll.isPending}
          onClick={() => logoutAll.mutate()}
        >
          {logoutAll.isPending ? <Spinner /> : <LogOut className="size-4" />}
          Sign out everywhere
        </Button>
      </div>
    </div>
  )
}
