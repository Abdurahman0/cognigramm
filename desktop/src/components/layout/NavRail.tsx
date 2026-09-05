import { MessageSquare, Phone, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage, Badge, Tooltip, initialsOf } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const ITEMS: NavItem[] = [
  { to: '/chats', label: 'Chats', icon: MessageSquare },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const ITEM_HEIGHT = 44
const ITEM_GAP = 6

/**
 * The vertical rail, with the same travelling selection lens as the mobile tab
 * bar: one bead that slides between slots rather than four backgrounds fading
 * in and out, so the selection reads as a single object moving.
 */
export function NavRail() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const unreadTotal = useChatStore((state) =>
    Object.values(state.unreadByConversation).reduce((sum, count) => sum + count, 0),
  )

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((item) => location.pathname.startsWith(item.to)),
  )

  return (
    <nav className="glass-panel flex w-14 shrink-0 flex-col items-center gap-1.5 rounded-2xl py-3">
      <div className="relative flex flex-col" style={{ gap: ITEM_GAP }}>
        <span
          aria-hidden
          className="selection-bead pointer-events-none absolute inset-x-0 rounded-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            height: ITEM_HEIGHT,
            transform: `translateY(${activeIndex * (ITEM_HEIGHT + ITEM_GAP)}px)`,
          }}
        />
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <Tooltip key={to} content={label} side="right">
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  'relative z-10 grid place-items-center rounded-xl transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
              style={{ width: ITEM_HEIGHT, height: ITEM_HEIGHT }}
            >
              <Icon className="size-[18px]" />
              {to === '/chats' && unreadTotal > 0 ? (
                <Badge size="sm" className="absolute top-1.5 right-1.5">
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </Badge>
              ) : null}
            </NavLink>
          </Tooltip>
        ))}
      </div>

      <div className="mt-auto">
        <Tooltip content={user?.fullName ?? 'Profile'} side="right">
          <NavLink to="/settings" aria-label="Profile">
            <Avatar className="size-9">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback>{initialsOf(user?.fullName ?? '?')}</AvatarFallback>
            </Avatar>
          </NavLink>
        </Tooltip>
      </div>
    </nav>
  )
}
