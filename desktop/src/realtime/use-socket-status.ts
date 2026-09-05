import { useEffect, useState } from 'react'

import { realtime, type SocketStatus } from '@/realtime/socket'

/** Live socket status, for the connection pill and the settings panel. */
export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(() => realtime.getStatus())
  useEffect(() => realtime.onStatus(setStatus), [])
  return status
}
