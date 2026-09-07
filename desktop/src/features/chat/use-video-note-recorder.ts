import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Round video message recording.
 *
 * The circle is presentation, not encoding: the backend stores whatever bytes
 * it is given and explicitly does not crop, so the camera stream is recorded
 * as it comes and the round shape is a CSS mask on both the viewfinder and the
 * bubble. That avoids a per-frame canvas draw loop for a result nobody can
 * tell apart.
 */

/** Anything shorter is a misfire, not a message. */
export const MIN_VIDEO_MS = 800

/** Telegram's ceiling, and a sensible one: past a minute, write it instead. */
export const MAX_VIDEO_MS = 60_000

export interface VideoNoteRecording {
  file: File
  durationMs: number
  width: number
  height: number
  mimeType: string
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'processing'

const pickMimeType = (): string => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }
  return ''
}

export function useVideoNoteRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  const teardown = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setStream(null)
  }, [])

  // A recording still running when the composer unmounts would hold the camera
  // light on with no way to switch it off.
  useEffect(() => teardown, [teardown])

  const start = useCallback(async (): Promise<boolean> => {
    if (state !== 'idle') return false
    setError(null)
    setState('requesting')

    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getUserMedia({
        // Square-ish and small: a round bubble never shows more than this, and
        // the file has to survive an upload on a bad connection.
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (mediaError) {
      setState('idle')
      setError(
        mediaError instanceof Error && mediaError.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : 'No camera available',
      )
      return false
    }

    streamRef.current = media
    setStream(media)
    chunksRef.current = []
    cancelledRef.current = false
    setDurationMs(0)

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.start()

    startedAtRef.current = Date.now()
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current
      setDurationMs(elapsed)
      // Stopping at the ceiling rather than silently truncating later.
      if (elapsed >= MAX_VIDEO_MS && recorderRef.current?.state === 'recording') {
        recorderRef.current.requestData()
      }
    }, 100)

    setState('recording')
    return true
  }, [state])

  const finish = useCallback(async (): Promise<VideoNoteRecording | null> => {
    const recorder = recorderRef.current
    if (!recorder || state !== 'recording') return null

    setState('processing')
    const durationAtStop = Date.now() - startedAtRef.current
    const track = streamRef.current?.getVideoTracks()[0]
    const settings = track?.getSettings()

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' }))
      }
      recorder.stop()
    })

    teardown()
    setState('idle')
    setDurationMs(0)

    if (cancelledRef.current || durationAtStop < MIN_VIDEO_MS) return null

    const extension = (recorder.mimeType || 'video/webm').includes('mp4') ? 'mp4' : 'webm'
    const file = new File([blob], `video-note-${Date.now()}.${extension}`, {
      type: blob.type || 'video/webm',
    })

    return {
      file,
      durationMs: durationAtStop,
      width: settings?.width ?? 640,
      height: settings?.height ?? 640,
      mimeType: file.type,
    }
  }, [state, teardown])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    if (recorderRef.current && state === 'recording') recorderRef.current.stop()
    teardown()
    setState('idle')
    setDurationMs(0)
  }, [state, teardown])

  return {
    state,
    isRecording: state === 'recording',
    durationMs,
    /** Live camera feed, for the viewfinder. */
    stream,
    error,
    start,
    finish,
    cancel,
  }
}
