import { Info, Phone, Search, Video } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage, Button, Tooltip, initialsOf } from '@/components/ui'
import { callEngine } from '@/features/calls/call-engine'
import { PresenceDot } from '@/features/conversations/PresenceDot'
import { formatLastSeen } from '@/lib/format'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import type { Conversation, User } from '@/types'

interface ChatHeaderProps {
  conversation: Conversation
  peer: User | undefined
  onToggleSearch: () => void
  searchOpen: boolean
}

export function ChatHeader({ conversation, peer, onToggleSearch, searchOpen }: ChatHeaderProps) {
  const isOnline = useChatStore((state) =>
    conversation.peerId ? state.onlineUserIds.includes(conversation.peerId) : false,
  )
  const typingIds = useChatStore((state) => state.typingByConversation[conversation.id])
  const detailsOpen = useUiStore((state) => state.detailsOpen)
  const setDetailsOpen = useUiStore((state) => state.setDetailsOpen)

  const title =
    conversation.kind === 'direct' ? (peer?.fullName ?? conversation.title) : conversation.title

  const subtitle =
    typingIds && typingIds.length > 0
      ? 'typing…'
      : conversation.kind === 'group'
        ? `${conversation.members.length} members`
        : isOnline
          ? 'online'
          : formatLastSeen(peer?.lastSeenAt ?? null)

  const startCall = (callType: 'audio' | 'video') => {
    void callEngine.start(conversation.id, conversation.peerId, callType)
  }

  return (
    <header className="border-border/60 flex h-14 shrink-0 items-center gap-3 border-b px-3">
      <div className="relative">
        <Avatar className="size-9">
          {peer?.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initialsOf(title)}</AvatarFallback>
        </Avatar>
        <PresenceDot userId={conversation.peerId} className="size-2.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{title}</p>
        <p className="text-muted-foreground truncate text-[12px]">{subtitle}</p>
      </div>

      <Tooltip content="Audio call">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Start audio call"
          onClick={() => startCall('audio')}
        >
          <Phone className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Video call">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Start video call"
          onClick={() => startCall('video')}
        >
          <Video className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Search in chat">
        <Button
          size="icon"
          variant={searchOpen ? 'secondary' : 'ghost'}
          aria-label="Search in conversation"
          aria-pressed={searchOpen}
          onClick={onToggleSearch}
        >
          <Search className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Conversation info">
        <Button
          size="icon"
          variant={detailsOpen ? 'secondary' : 'ghost'}
          aria-label="Conversation info"
          aria-pressed={detailsOpen}
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <Info className="size-4" />
        </Button>
      </Tooltip>
    </header>
  )
}
