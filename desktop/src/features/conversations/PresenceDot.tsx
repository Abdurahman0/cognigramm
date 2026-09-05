import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'

/** The online ring on an avatar. Reads the live set the socket maintains. */
export function PresenceDot({ userId, className }: { userId: number | null; className?: string }) {
  const isOnline = useChatStore((state) => (userId ? state.onlineUserIds.includes(userId) : false))
  if (!userId || !isOnline) return null
  return (
    <span
      aria-label="Online"
      className={cn(
        'bg-success absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-[var(--wallpaper-c)]',
        className,
      )}
    />
  )
}
