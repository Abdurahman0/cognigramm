import { useEffect, useRef } from 'react'

const SIZE = 232

/**
 * The live camera preview while a video message records.
 *
 * Mirrored, like every self-view: people expect to move left and see the image
 * move left. Only the preview is flipped — the recording keeps the true frame,
 * so text held up to the camera is readable to the person watching it.
 */
export function VideoNoteViewfinder({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    if (stream) void video.play().catch(() => undefined)
  }, [stream])

  return (
    <div
      className="ring-destructive/70 pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 overflow-hidden rounded-full shadow-2xl ring-2"
      style={{ width: SIZE, height: SIZE }}
    >
      <video ref={videoRef} muted playsInline className="size-full scale-x-[-1] object-cover" />
    </div>
  )
}
