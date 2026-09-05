import { useQuery } from '@tanstack/react-query'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react'
import { useMemo } from 'react'

import { toCallRecord } from '@/api/adapters'
import { callsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Skeleton,
  Tooltip,
  initialsOf,
} from '@/components/ui'
import { callEngine } from '@/features/calls/call-engine'
import { useDirectory } from '@/hooks/use-users'
import { formatDuration, formatListTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import type { CallRecord } from '@/types'

const isMissed = (call: CallRecord): boolean =>
  call.state === 'missed' || call.state === 'rejected' || call.state === 'cancelled'

function CallIcon({ call }: { call: CallRecord }) {
  if (isMissed(call)) return <PhoneMissed className="text-destructive size-4" />
  if (call.direction === 'outgoing')
    return <PhoneOutgoing className="text-muted-foreground size-4" />
  return <PhoneIncoming className="text-success size-4" />
}

const durationOf = (call: CallRecord): string => {
  if (!call.startedAt || !call.endedAt) return ''
  return formatDuration(new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime())
}

/** Call history, newest first, with one-click redial. */
export function CallsPage() {
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)
  const { byId } = useDirectory()

  const { data, isPending } = useQuery({
    queryKey: queryKeys.callHistory,
    queryFn: () => callsApi.history({ limit: 60 }),
    staleTime: 30_000,
  })

  const calls = useMemo(
    () => (data?.calls ?? []).map((call) => toCallRecord(call, currentUserId)),
    [data, currentUserId],
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-border/60 flex h-14 shrink-0 items-center border-b px-4">
        <h1 className="text-[15px] font-semibold">Calls</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto w-full max-w-3xl">
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : calls.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-[13px]">No calls yet.</p>
          ) : (
            <div className="space-y-1.5">
              {calls.map((call) => {
                const peerId = call.participantIds.find((id) => id !== currentUserId) ?? null
                const peer = peerId ? byId.get(peerId) : undefined
                const name = peer?.fullName ?? `Conversation ${call.conversationId}`

                return (
                  <div
                    key={call.id}
                    className="raised-card flex items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <Avatar className="size-10">
                      {peer?.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{initialsOf(name)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-[14px] font-medium',
                          isMissed(call) && 'text-destructive',
                        )}
                      >
                        {name}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1.5 truncate text-[12px]">
                        <CallIcon call={call} />
                        {call.callType === 'video' ? 'Video' : 'Audio'}
                        {durationOf(call) ? ` · ${durationOf(call)}` : ''}
                        {isMissed(call) ? ` · ${call.state}` : ''}
                      </p>
                    </div>

                    <span className="text-faint-foreground shrink-0 text-[11px] tabular-nums">
                      {formatListTime(call.createdAt)}
                    </span>

                    <Tooltip content={`Call back (${call.callType})`}>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Call ${name} back`}
                        onClick={() =>
                          void callEngine.start(call.conversationId, peerId, call.callType)
                        }
                      >
                        {call.callType === 'video' ? (
                          <Video className="size-4" />
                        ) : (
                          <PhoneOutgoing className="size-4" />
                        )}
                      </Button>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
