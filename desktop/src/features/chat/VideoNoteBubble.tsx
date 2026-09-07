import { Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui'
import { useMediaUrl } from '@/hooks/use-media-url'
import { formatDuration } from '@/lib/format'
import type { Attachment } from '@/types'

const SIZE = 208
const STROKE = 3
const RADIUS = SIZE / 2 - STROKE / 2 - 1
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const readDuration = (metadata: Record<string, unknown> | null): number => {
  const raw = metadata?.duration_ms
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0
}

/**
 * A round video message, with playback progress running around the rim.
 *
 * Three things make the ring behave, and each was a visible fault without it:
 *
 *  - **Duration comes from the file first, metadata second.** A note recorded
 *    by a client that sends no `duration_ms` left the ring frozen at zero for
 *    the whole take.
 *  - **A WebM from `MediaRecorder` reports `duration === Infinity`** until it
 *    is seeked to the end, so the length is forced out of it on load.
 *  - **Progress is driven by animation frames, not `timeupdate`.** That event
 *    fires about four times a second, which the ring showed as four jumps —
 *    and a CSS transition smoothing them only added lag.
 */
export function VideoNoteBubble({ attachment }: { attachment: Attachment }) {
  const { url, isResolving, isUnavailable, retry } = useMediaUrl(attachment)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [durationMs, setDurationMs] = useState(() => readDuration(attachment.metadata))

  const stopTracking = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }, [])

  const track = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setElapsedMs(video.currentTime * 1000)
    frameRef.current = requestAnimationFrame(track)
  }, [])

  useEffect(() => stopTracking, [stopTracking])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return

    // A recorded WebM carries no duration until the reader has been to the
    // end of it. Seeking past the end forces the real value, then the position
    // is put back so the note still starts from the beginning.
    const resolveDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDurationMs(video.duration * 1000)
        return
      }
      const onSeeked = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          setDurationMs(video.duration * 1000)
        }
        video.currentTime = 0
        video.removeEventListener('seeked', onSeeked)
      }
      video.addEventListener('seeked', onSeeked)
      video.currentTime = 1e101
    }

    const onEnded = () => {
      stopTracking()
      setIsPlaying(false)
      setElapsedMs(0)
      video.currentTime = 0
    }

    video.addEventListener('loadedmetadata', resolveDuration)
    video.addEventListener('ended', onEnded)
    if (video.readyState >= 1) resolveDuration()

    return () => {
      video.removeEventListener('loadedmetadata', resolveDuration)
      video.removeEventListener('ended', onEnded)
    }
  }, [url, stopTracking])

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
      void video.play().then(() => {
        setIsPlaying(true)
        stopTracking()
        frameRef.current = requestAnimationFrame(track)
      })
    } else {
      video.pause()
      stopTracking()
      setIsPlaying(false)
    }
  }

  const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 0
  const remaining = Math.max(0, durationMs - elapsedMs)

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

      {/* The rim is the progress bar, so the note stays a single object. */}
      <svg
        className="pointer-events-none absolute inset-0 -rotate-90"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="black"
          strokeOpacity="0.35"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="white"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>

      {!isPlaying ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
            <Play className="size-5 translate-x-px text-white" />
          </span>
        </span>
      ) : null}

      {/* Counts down while playing, the way a voice note does. */}
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white tabular-nums">
        {formatDuration(isPlaying ? remaining : durationMs)}
      </span>
    </button>
  )
}
