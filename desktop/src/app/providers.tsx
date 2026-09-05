import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { ApiError } from '@/api/client'
import { Toaster, TooltipProvider } from '@/components/ui'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'

const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // The socket is the live channel; refetching on every window focus
        // would re-request data the server has already pushed.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // 4xx means the request itself is wrong — retrying just repeats it.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
      },
      mutations: { retry: 0 },
    },
  })

export function AppProviders({ children }: { children: ReactNode }) {
  // Created once per mount rather than at module scope, so tests get a clean
  // cache and React's strict double-render does not share one client.
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400}>
        <RealtimeProvider>
          {children}
          <Toaster />
        </RealtimeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
