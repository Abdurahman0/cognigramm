import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Voice message recording.
 *
 * The backend stores whatever bytes it is given and derives nothing from them,
 * so duration and waveform are the client's job. The waveform is sampled live
 * from an analyser node rather than decoded afterwards: decoding a finished
 * blob costs a second of main-thread time for a result nobody can tell apart.
 */

/** Bars in the stored waveform. Enough shape to read, small enough to send. */
const WAVEFORM_BUCKETS = 48

/** Amplitude sampling rate, in samples per second. */
const SAMPLE_HZ = 20

/** Anything shorter is a misfire, not a message. */
export const MIN_DURATION_MS = 700

export interface VoiceRecording {
  file: File
  durationMs: number
  waveform: number[]
  mimeType: string
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'processing'

/** The first container the browser admits to supporting. */
const pickMimeType = (): string => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }
  return ''
}

/** Reduces the live samples to a fixed number of bars, each 0-100. */
const toWaveform = (samples: number[]): number[] => {
  if (samples.length === 0) return new Array<number>(WAVEFORM_BUCKETS).fill(4)
  const buckets: number[] = []
  const size = samples.length / WAVEFORM_BUCKETS
  for (let index = 0; index < WAVEFORM_BUCKETS; index += 1) {
    const start = Math.floor(index * size)
    const end = Math.max(start + 1, Math.floor((index + 1) * size))
    let peak = 0
    for (let cursor = start; cursor < end && cursor < samples.length; cursor += 1) {
      peak = Math.max(peak, samples[cursor] ?? 0)
    }
    buckets.push(Math.round(peak * 100))
  }
  // Normalise so a quiet recording still shows shape rather than a flat line.
  const loudest = Math.max(...buckets, 1)
  return buckets.map((value) => Math.max(3, Math.round((value / loudest) * 100)))
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [levels, setLevels] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const samplesRef = useRef<number[]>([])
  const startedAtRef = useRef(0)
  const timersRef = useRef<{
    tick?: ReturnType<typeof setInterval>
    sample?: ReturnType<typeof setInterval>
  }>({})
  const cancelledRef = useRef(false)

  const teardown = useCallback(() => {
    if (timersRef.current.tick) clearInterval(timersRef.current.tick)
    if (timersRef.current.sample) clearInterval(timersRef.current.sample)
    timersRef.current = {}
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void contextRef.current?.close().catch(() => undefined)
    contextRef.current = null
    recorderRef.current = null
  }, [])

  // A recording left running when the composer unmounts would hold the
  // microphone open with no way to stop it.
  useEffect(() => teardown, [teardown])

  const start = useCallback(async (): Promise<boolean> => {
    if (state !== 'idle') return false
    setError(null)
    setState('requesting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (mediaError) {
      setState('idle')
      setError(
        mediaError instanceof Error && mediaError.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'No microphone available',
      )
      return false
    }

    streamRef.current = stream
    chunksRef.current = []
    samplesRef.current = []
    cancelledRef.current = false
    setLevels([])
    setDurationMs(0)

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.start()

    // Live amplitude, for the bars drawn while recording and for the waveform
    // stored with the message.
    const context = new AudioContext()
    contextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    context.createMediaStreamSource(stream).connect(analyser)
    const buffer = new Uint8Array(analyser.frequencyBinCount)

    startedAtRef.current = Date.now()
    timersRef.current.tick = setInterval(
      () => setDurationMs(Date.now() - startedAtRef.current),
      100,
    )
    timersRef.current.sample = setInterval(() => {
      analyser.getByteTimeDomainData(buffer)
      let peak = 0
      for (const value of buffer) {
        peak = Math.max(peak, Math.abs(value - 128) / 128)
      }
      samplesRef.current.push(peak)
      setLevels((previous) => [...previous.slice(-(WAVEFORM_BUCKETS - 1)), peak])
    }, 1000 / SAMPLE_HZ)

    setState('recording')
    return true
  }, [state])

  const finish = useCallback(async (): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current
    if (!recorder || state !== 'recording') return null

    setState('processing')
    const durationAtStop = Date.now() - startedAtRef.current

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
      }
      recorder.stop()
    })

    const waveform = toWaveform(samplesRef.current)
    teardown()
    setState('idle')
    setDurationMs(0)
    setLevels([])

    if (cancelledRef.current || durationAtStop < MIN_DURATION_MS) return null

    const extension = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
    const file = new File([blob], `voice-${Date.now()}.${extension}`, {
      type: blob.type || 'audio/webm',
    })

    return { file, durationMs: durationAtStop, waveform, mimeType: file.type }
  }, [state, teardown])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    if (recorderRef.current && state === 'recording') {
      recorderRef.current.stop()
    }
    teardown()
    setState('idle')
    setDurationMs(0)
    setLevels([])
  }, [state, teardown])

  return {
    state,
    isRecording: state === 'recording',
    durationMs,
    /** Recent amplitudes, 0-1, for the live meter. */
    levels,
    error,
    start,
    finish,
    cancel,
  }
}
