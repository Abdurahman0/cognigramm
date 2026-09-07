import { Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui'
import { useMediaUrl } from '@/hooks/use-media-url'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Attachment } from '@/types'

const SIZE = 208

const readDuration = (metadata: Record<string, unknown> | null): number => {
  const raw = metadata?.duration_ms
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}

/**
 * A round video message.
 *
 * The circle is a mask, not the stored shape — the backend keeps the frame as
 * recorded — so playback crops to a centred square and rounds it, the same way
 * the mobile client does. Progress runs around the rim so the note stays one
 * object while it plays.
 */
export function VideoNoteBubble({ attachment }: { attachment: Attachment }) {
  const { url, isResolving, isUnavailable, retry } = useMediaUrl(attachment)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const totalMs = readDuration(attachment.metadata)
  const progress = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => setElapsedMs(video.currentTime * 1000)
    const onEnd = () => {
      setIsPlaying(false)
      setElapsedMs(0)
      video.currentTime = 0
    }
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnd)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnd)
    }
  }, [url])

  if (isUnavailable) {
    return <p className="text-[13px] opacity-70">Video message is no longer available</p>
  }

  if (!url) {
    return isResolving ? (
      <Skeleton className="rounded-full" style={{ width: SIZE, height: SIZE }} />
    ) : null
  }

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().then(() => setIsPlaying(true))
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const circumference = 2 * Math.PI * (SIZE / 2 - 2)

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPlaying ? 'Pause video message' : 'Play video message'}
      className="relative block shrink-0"
      style={{ width: SIZE, height: SIZE }}
    >
      <video
        ref={videoRef}
        src={url}
        onError={retry}
        playsInline
        preload="metadata"
        className="size-full rounded-full object-cover"
      />

      {/* The rim doubles as the progress track, so no separate bar is needed. */}
      <svg
        className="pointer-events-none absolute inset-0 -rotate-90"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={SIZE / 2 - 2}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-20"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={SIZE / 2 - 2}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="text-white transition-[stroke-dashoffset] duration-150"
        />
      </svg>

      {!isPlaying ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
            <Play className="size-5 translate-x-px text-white" />
          </span>
        </span>
      ) : null}

      <span
        className={cn(
          'absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5',
          'text-[11px] text-white tabular-nums',
        )}
      >
        {formatDuration(isPlaying || elapsedMs > 0 ? elapsedMs : totalMs)}
      </span>
    </button>
  )
}
