import { useEffect, useState } from 'react'

import { subscribeStreams } from '@/features/calls/call-engine'

/** The live MediaStreams, for binding to <video> elements. */
export function useCallStreams() {
  const [streams, setStreams] = useState<{ local: MediaStream | null; remote: MediaStream | null }>(
    {
      local: null,
      remote: null,
    },
  )

  useEffect(() => subscribeStreams(setStreams), [])

  return streams
}
