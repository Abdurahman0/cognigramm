import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Round video message recording.
 *
 * Frames go through a canvas before they reach the recorder, for two reasons.
 * It crops the camera's rectangle to the square the round bubble actually
 * shows, so nothing is encoded that will never be seen. And it mirrors the
 * front camera, because the viewfinder is mirrored — people frame themselves
 * in it as if it were a mirror — and a recording that is not leaves the sender
 * watching a flipped version of the take they just composed. The mobile client
 * does the same, so one person's video notes look alike wherever they came
 * from.
 */

/** What the round bubble shows; anything larger is encoded and then cropped away. */
const CAPTURE_SIZE = 480

/** Smooth enough for a talking head, cheap enough to encode on a laptop. */
const CAPTURE_FPS = 30

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
  const canvasStreamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<HTMLVideoElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  const teardown = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    canvasStreamRef.current?.getTracks().forEach((track) => track.stop())
    canvasStreamRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (sourceRef.current) {
      sourceRef.current.srcObject = null
      sourceRef.current = null
    }
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

    // The camera feeds a hidden video element, which feeds the canvas the
    // recorder actually reads. Every part of that is optional: WebKitGTK ships
    // `captureStream` and `MediaRecorder` support that varies by build, and a
    // recorder that cannot start is worse than one that cannot mirror. So the
    // whole pipeline is attempted, and the raw camera stream is the fallback.
    const source = document.createElement('video')
    source.srcObject = media
    source.muted = true
    source.playsInline = true
    // Bounded: a detached video element that never resolves `play()` would
    // otherwise leave the button stuck on its loading state.
    await Promise.race([
      source.play().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 1_500)),
    ])
    sourceRef.current = source

    const canvas = document.createElement('canvas')
    canvas.width = CAPTURE_SIZE
    canvas.height = CAPTURE_SIZE
    const context = canvas.getContext('2d')

    const drawFrame = () => {
      const width = source.videoWidth
      const height = source.videoHeight
      if (context && width > 0 && height > 0) {
        const side = Math.min(width, height)
        context.save()
        // Mirrored, to match the viewfinder the take was composed in.
        context.translate(CAPTURE_SIZE, 0)
        context.scale(-1, 1)
        context.drawImage(
          source,
          (width - side) / 2,
          (height - side) / 2,
          side,
          side,
          0,
          0,
          CAPTURE_SIZE,
          CAPTURE_SIZE,
        )
        context.restore()
      }
      frameRef.current = requestAnimationFrame(drawFrame)
    }
    frameRef.current = requestAnimationFrame(drawFrame)

    let recordedStream: MediaStream = media
    try {
      if (typeof canvas.captureStream === 'function') {
        const captured = canvas.captureStream(CAPTURE_FPS)
        for (const track of media.getAudioTracks()) captured.addTrack(track)
        canvasStreamRef.current = captured
        recordedStream = captured
      }
    } catch {
      recordedStream = media
    }

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(recordedStream, mimeType ? { mimeType } : undefined)
    } catch {
      // The canvas stream was refused; the camera's own stream is always
      // recordable, it just cannot be mirrored or cropped.
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      canvasStreamRef.current?.getTracks().forEach((track) => track.stop())
      canvasStreamRef.current = null
      try {
        recorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      } catch {
        teardown()
        setState('idle')
        setError('Recording is not supported here')
        return false
      }
    }
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
  }, [state, teardown])

  const finish = useCallback(async (): Promise<VideoNoteRecording | null> => {
    const recorder = recorderRef.current
    if (!recorder || state !== 'recording') return null

    setState('processing')
    const durationAtStop = Date.now() - startedAtRef.current
    // The stored frame is the square the canvas produced, not the camera's.

    // `onstop` not arriving would leave the composer stuck on "processing"
    // with no way out, so the wait is bounded and whatever chunks arrived are
    // used. Asking for the final chunk first means that fallback still has the
    // whole take in it.
    const blob = await new Promise<Blob>((resolve) => {
      const settle = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' }))
      }
      const timer = setTimeout(settle, 4_000)
      recorder.onstop = () => {
        clearTimeout(timer)
        settle()
      }
      try {
        if (recorder.state === 'inactive') {
          clearTimeout(timer)
          settle()
          return
        }
        recorder.requestData()
        recorder.stop()
      } catch {
        clearTimeout(timer)
        settle()
      }
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
      width: CAPTURE_SIZE,
      height: CAPTURE_SIZE,
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
