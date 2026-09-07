import incomingTone from '@/assets/incoming-call.mp3'
import outgoingTone from '@/assets/outgoing-call.mp3'

/**
 * The two sounds a call makes before it connects.
 *
 * `incoming` rings this device when somebody calls; `outgoing` is the ringback
 * you hear while the other end is being rung. Both loop until the call is
 * answered, declined or cancelled — which is what `stopCallTone` is for, and
 * why every path out of a ringing state has to call it.
 */
const SOURCES: Record<CallToneKind, string> = {
  incoming: incomingTone,
  outgoing: outgoingTone,
}

export type CallToneKind = 'incoming' | 'outgoing'

/** Loud enough to hear across a room, quiet enough not to startle. */
const VOLUME = 0.7

let element: HTMLAudioElement | null = null

export const stopCallTone = (): void => {
  if (!element) return
  element.pause()
  element.src = ''
  element = null
}

export const playCallTone = (kind: CallToneKind): void => {
  stopCallTone()
  try {
    const audio = new Audio(SOURCES[kind])
    audio.loop = true
    audio.volume = VOLUME
    element = audio
    // Autoplay policy: a call always follows a click somewhere, but a rejected
    // promise must not take the call down with it.
    void audio.play().catch(() => undefined)
  } catch {
    element = null
  }
}
