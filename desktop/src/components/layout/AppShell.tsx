import { Outlet } from 'react-router-dom'

import { NavRail } from '@/components/layout/NavRail'
import { TitleBar } from '@/components/layout/TitleBar'
import { CallOverlay } from '@/features/calls/CallOverlay'
import { IncomingCallDialog } from '@/features/calls/IncomingCallDialog'

/**
 * Desktop chrome: title bar on top, rail on the left, and a single glass
 * window holding whatever the route renders.
 */
export function AppShell() {
  return (
    <div className="app-wallpaper flex h-full flex-col overflow-hidden">
      <TitleBar />
      <div className="flex min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5">
        <NavRail />
        <main className="glass-panel flex min-w-0 flex-1 overflow-hidden rounded-2xl">
          <Outlet />
        </main>
      </div>
      <IncomingCallDialog />
      <CallOverlay />
    </div>
  )
}
