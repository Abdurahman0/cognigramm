import { Maximize2, Minus, Minimize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Tooltip } from '@/components/ui'
import { APP_NAME } from '@/lib/config'
import { isDesktopRuntime } from '@/lib/tauri'
import { closeWindow, isMaximized, minimizeWindow, toggleMaximizeWindow } from '@/lib/window'
import { cn } from '@/lib/utils'
import { useSocketStatus } from '@/realtime/use-socket-status'

const STATUS_LABEL: Record<string, string> = {
  idle: 'Offline',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Offline',
  error: 'Connection error',
}

function ConnectionPill() {
  const status = useSocketStatus()
  const tone =
    status === 'connected'
      ? 'bg-success'
      : status === 'connecting' || status === 'reconnecting'
        ? 'bg-warning animate-pulse'
        : 'bg-destructive'

  return (
    <div className="no-drag bg-input flex items-center gap-1.5 rounded-full px-2.5 py-1">
      <span className={cn('size-1.5 rounded-full', tone)} />
      <span className="text-muted-foreground text-[11px] font-medium">
        {STATUS_LABEL[status] ?? status}
      </span>
    </div>
  )
}

function WindowButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          'no-drag text-muted-foreground flex size-7 items-center justify-center rounded-md transition-colors',
          danger
            ? 'hover:bg-destructive hover:text-white'
            : 'hover:bg-accent hover:text-foreground',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

/**
 * The window's own title bar.
 *
 * The whole strip is a drag region except for the controls, which is what
 * makes a frameless window still feel like a native one.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isDesktopRuntime) return
    void isMaximized().then(setMaximized)
  }, [])

  return (
    <header className="drag-region flex h-11 shrink-0 items-center justify-between gap-3 px-3">
      <div className="flex items-center gap-2.5">
        <span className="bg-primary/15 grid size-6 place-items-center rounded-md text-[13px]">
          🐦‍⬛
        </span>
        <span className="text-[13px] font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionPill />
        {isDesktopRuntime ? (
          <div className="flex items-center gap-0.5">
            <WindowButton onClick={() => void minimizeWindow()} label="Minimize">
              <Minus className="size-3.5" />
            </WindowButton>
            <WindowButton
              onClick={() => {
                void toggleMaximizeWindow()
                setMaximized((value) => !value)
              }}
              label={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </WindowButton>
            <WindowButton onClick={() => void closeWindow()} label="Close to tray" danger>
              <X className="size-3.5" />
            </WindowButton>
          </div>
        ) : null}
      </div>
    </header>
  )
}
