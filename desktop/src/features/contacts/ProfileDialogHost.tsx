import { callEngine } from '@/features/calls/call-engine'
import { ProfileDialog } from '@/features/contacts/ProfileDialog'
import { useOpenDirectChat } from '@/hooks/use-open-direct-chat'
import type { User } from '@/types'

/**
 * The profile card plus the actions on it.
 *
 * Three places open a person's profile — the contacts grid, a conversation's
 * member list, and the chat header — and all three want the same "message" and
 * "call" behaviour behind it, so the wiring lives here once.
 */
export function ProfileDialogHost({ user, onClose }: { user: User | null; onClose: () => void }) {
  const openDirectChat = useOpenDirectChat()

  return (
    <ProfileDialog
      user={user}
      onClose={onClose}
      onMessage={(person) => {
        onClose()
        openDirectChat(person.id)
      }}
      onCall={(person, callType) => {
        onClose()
        openDirectChat(person.id, (conversationId) => {
          void callEngine.start(conversationId, person.id, callType)
        })
      }}
    />
  )
}
