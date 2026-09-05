import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Spinner } from '@/components/ui'
import { useMediaUrl } from '@/hooks/use-media-url'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Attachment } from '@/types'

/** Bars are drawn from the sender's waveform; this is the fallback shape. */
const FLAT_WAVEFORM = Array.from({ length: 32 }, (_, index) => 18 + ((index * 7) % 40))

const readWaveform = (metadata: Record<string, unknown> | null): number[] => {
  const raw = metadata?.waveform
  if (!Array.isArray(raw) || raw.length === 0) return FLAT_WAVEFORM
  return raw
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
    .map((value) => Math.min(100, Math.max(3, value)))
}

const readDuration = (metadata: Record<string, unknown> | null): number => {
  const raw = metadata?.duration_ms
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}

/**
 * A voice message: waveform, play/pause and a clock.
 *
 * The waveform comes from the sender — the backend stores bytes and derives
 * nothing — so playback only has to draw it and track progress against it.
 */
export function VoiceMessage({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const { url, isResolving, isUnavailable, retry } = useMediaUrl(attachment)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const waveform = readWaveform(attachment.metadata)
  const totalMs = readDuration(attachment.metadata)
  const progress = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setElapsedMs(audio.currentTime * 1000)
    const onEnd = () => {
      setIsPlaying(false)
      setElapsedMs(0)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
    }
  }, [url])

  if (isUnavailable) {
    return <p className="text-[13px] opacity-70">Voice message is no longer available</p>
  }

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().then(() => setIsPlaying(true))
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  /** Clicking a bar seeks to that point, the way every voice player does. */
  const seek = (fraction: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = audio.duration * fraction
    setElapsedMs(audio.currentTime * 1000)
  }

  return (
    <div className="flex w-64 max-w-full items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full transition-colors',
          mine ? 'bg-white/20 hover:bg-white/30' : 'bg-black/15 hover:bg-black/25',
        )}
      >
        {isResolving ? (
          <Spinner />
        ) : isPlaying ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4 translate-x-px" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="flex h-8 cursor-pointer items-center gap-[2px]"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            seek((event.clientX - bounds.left) / bounds.width)
          }}
        >
          {waveform.map((height, index) => {
            const played = index / waveform.length <= progress
            return (
              <span
                key={index}
                className={cn(
                  'min-w-[2px] flex-1 rounded-full transition-opacity',
                  mine ? 'bg-white' : 'bg-current',
                  played ? 'opacity-95' : 'opacity-45',
                )}
                // A floor of 22%: a quiet passage should still read as a bar
                // rather than dissolving into a dotted line.
                style={{ height: `${Math.max(22, height)}%` }}
              />
            )
          })}
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums opacity-70">
          {formatDuration(isPlaying || elapsedMs > 0 ? elapsedMs : totalMs)}
        </p>
      </div>

      {url ? <audio ref={audioRef} src={url} preload="metadata" onError={retry} hidden /> : null}
    </div>
  )
}
