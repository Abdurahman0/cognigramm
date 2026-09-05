import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui'

interface State {
  error: Error | null
}

/**
 * A crash in the renderer would otherwise leave a blank window with no way
 * back — there is no browser reload button in a frameless Tauri shell.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="app-wallpaper grid h-full place-items-center p-8">
        <div className="glass-panel max-w-md space-y-3 rounded-2xl p-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-[13px] break-words">{error.message}</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    )
  }
}
