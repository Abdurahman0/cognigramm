import { Outlet } from 'react-router-dom'

import { ConversationList } from '@/features/conversations/ConversationList'

/**
 * Two-pane chat surface. The list is the layout route so it keeps its scroll
 * position and queries while the transcript on the right swaps per chat.
 */
export function ChatsPage() {
  return (
    <div className="flex min-w-0 flex-1">
      <ConversationList />
      <Outlet />
    </div>
  )
}
