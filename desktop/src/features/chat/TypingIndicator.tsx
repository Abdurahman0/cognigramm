import { useChatStore } from '@/stores/chat'
import type { User } from '@/types'

/** "Alice is typing…", with the three-dot animation every messenger uses. */
export function TypingIndicator({
  conversationId,
  usersById,
}: {
  conversationId: number
  usersById: Map<number, User>
}) {
  const typingIds = useChatStore((state) => state.typingByConversation[conversationId])
  if (!typingIds || typingIds.length === 0) return null

  const names = typingIds
    .map((id) => usersById.get(id)?.fullName ?? 'Someone')
    .slice(0, 3)
    .join(', ')

  return (
    <div className="text-muted-foreground flex items-center gap-2 px-4 py-1.5 text-[12px]">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </span>
      <span>
        {names} {typingIds.length > 1 ? 'are' : 'is'} typing…
      </span>
    </div>
  )
}
