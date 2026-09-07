import { AtSign, Clock, Mail, MapPin, MessageSquare, Phone, PhoneCall, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Separator,
  initialsOf,
} from '@/components/ui'
import { formatLastSeen } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import type { User, UserPresence } from '@/types'

const PRESENCE_LABEL: Record<UserPresence, string> = {
  available: 'Available',
  in_meeting: 'In a meeting',
  busy: 'Busy',
  on_break: 'On a break',
  remote: 'Working remotely',
  offline: 'Offline',
}

const PRESENCE_TONE: Record<UserPresence, string> = {
  available: 'bg-success',
  in_meeting: 'bg-warning',
  busy: 'bg-destructive',
  on_break: 'bg-warning',
  remote: 'bg-primary',
  offline: 'bg-muted-foreground',
}

/**
 * The time it is where this person is.
 *
 * In a workspace spread across time zones, this is the one field that changes
 * whether you call someone now or write to them instead.
 */
const localTimeOf = (timezone: string): string | null => {
  if (!timezone) return null
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
  } catch {
    // The server accepts any string in this field; an invalid one is not worth
    // an error, it just means there is no clock to show.
    return null
  }
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 px-1 py-1.5">
      <Icon className="text-faint-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-faint-foreground text-[11px] tracking-wide uppercase">{label}</p>
        <p data-selectable className="text-[13px] break-words">
          {value}
        </p>
      </div>
    </div>
  )
}

interface ProfileDialogProps {
  user: User | null
  onClose: () => void
  onMessage: (user: User) => void
  onCall: (user: User, callType: 'audio' | 'video') => void
}

/** A person's card: who they are, how to reach them, and what time it is there. */
export function ProfileDialog({ user, onClose, onMessage, onCall }: ProfileDialogProps) {
  const isOnline = useChatStore((state) => (user ? state.onlineUserIds.includes(user.id) : false))

  if (!user) return <Dialog open={false} onOpenChange={onClose} />

  const presence: UserPresence = isOnline ? user.presence : 'offline'
  const localTime = localTimeOf(user.timezone)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <Avatar className="size-20">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xl">{initialsOf(user.fullName)}</AvatarFallback>
          </Avatar>

          <div>
            <DialogTitle className="text-lg">{user.fullName}</DialogTitle>
            <DialogDescription className="mt-0.5">
              @{user.username}
              {user.title ? ` · ${user.title}` : ''}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-1.5 text-[13px]">
            <span className={cn('size-2 rounded-full', PRESENCE_TONE[presence])} />
            <span className="text-muted-foreground">
              {isOnline ? PRESENCE_LABEL[presence] : formatLastSeen(user.lastSeenAt)}
            </span>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onMessage(user)}>
            <MessageSquare className="size-4" /> Message
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label={`Call ${user.fullName}`}
            onClick={() => onCall(user, 'audio')}
          >
            <PhoneCall className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label={`Video call ${user.fullName}`}
            onClick={() => onCall(user, 'video')}
          >
            <Video className="size-4" />
          </Button>
        </div>

        {user.about ? (
          <>
            <Separator />
            <p data-selectable className="text-muted-foreground px-1 text-[13px] leading-relaxed">
              {user.about}
            </p>
          </>
        ) : null}

        <Separator />

        <div className="space-y-0.5">
          <DetailRow icon={Mail} label="Email" value={user.email} />
          {user.phone ? <DetailRow icon={Phone} label="Phone" value={user.phone} /> : null}
          {user.handle ? <DetailRow icon={AtSign} label="Handle" value={user.handle} /> : null}
          {localTime ? (
            <DetailRow icon={Clock} label="Local time" value={`${localTime} · ${user.timezone}`} />
          ) : null}
          {user.officeLocation ? (
            <DetailRow icon={MapPin} label="Office" value={user.officeLocation} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
