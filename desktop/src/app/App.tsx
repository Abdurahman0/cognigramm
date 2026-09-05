import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { CallsPage } from '@/features/calls/CallsPage'
import { ChatEmptyState, ChatScreen } from '@/features/chat/ChatScreen'
import { ChatsPage } from '@/features/chat/ChatsPage'
import { ContactsPage } from '@/features/contacts/ContactsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useSession } from '@/hooks/use-session'
import { useThemeEffect } from '@/hooks/use-theme'
import { useOnlinePresence } from '@/hooks/use-users'
import { useAuthStore } from '@/stores/auth'

function Splash() {
  return (
    <div className="app-wallpaper grid h-full place-items-center">
      <Spinner className="text-muted-foreground size-6" />
    </div>
  )
}

export function App() {
  const status = useAuthStore((state) => state.status)
  const token = useAuthStore((state) => state.token)

  useThemeEffect()
  useSession()
  useOnlinePresence(Boolean(token))

  // `unknown` only lasts until the persisted store rehydrates; showing the
  // login form during it would flash for anyone already signed in.
  if (status === 'unknown') return <Splash />
  if (!token) return <AuthScreen />

  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/chats" replace />} />
          <Route path="chats" element={<ChatsPage />}>
            <Route index element={<ChatEmptyState />} />
            <Route path=":conversationId" element={<ChatScreen />} />
          </Route>
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="calls" element={<CallsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}
