import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { TitleBar } from '@/components/layout/TitleBar'
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
import { useEffect } from 'react'

/**
 * Chrome for the screens that live outside the app shell.
 *
 * The window is frameless, so every screen has to carry its own title bar —
 * on the sign-in screen there is otherwise no drag region and no close button,
 * and the window cannot be moved or dismissed at all.
 */
function WindowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-wallpaper flex h-full flex-col overflow-hidden">
      <TitleBar showStatus={false} />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <Spinner className="text-muted-foreground size-6" />
    </div>
  )
}

export function App() {
  const status = useAuthStore((state) => state.status)
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const isAuthenticated = status === 'authenticated'

  useThemeEffect()
  useSession()
  useOnlinePresence(isAuthenticated)

  // Startup order matters: refresh the token first, then read the profile,
  // then let the socket open. Doing it the other way round opens a socket with
  // an access token that expired while the app was closed.
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // `unknown` lasts until that first refresh settles; showing the login form
  // during it would flash for anyone already signed in.
  if (status === 'unknown')
    return (
      <WindowFrame>
        <Splash />
      </WindowFrame>
    )
  if (!isAuthenticated)
    return (
      <WindowFrame>
        <AuthScreen />
      </WindowFrame>
    )

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
