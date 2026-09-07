/**
 * The message ping.
 *
 * Synthesised rather than shipped as an asset: two short tones a fifth apart,
 * quiet enough to sit under a conversation. A file would be one more thing to
 * bundle, license and keep in sync with the theme.
 */
let context: AudioContext | null = null

const getContext = (): AudioContext | null => {
  if (typeof AudioContext === 'undefined') return null
  context ??= new AudioContext()
  // Browsers suspend audio contexts created before the first interaction.
  if (context.state === 'suspended') void context.resume().catch(() => undefined)
  return context
}

export const playMessageTone = (): void => {
  const audio = getContext()
  if (!audio) return

  try {
    const now = audio.currentTime
    const gain = audio.createGain()
    gain.connect(audio.destination)
    gain.gain.setValueAtTime(0.0001, now)

    for (const [index, frequency] of [880, 1320].entries()) {
      const start = now + index * 0.09
      const oscillator = audio.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      oscillator.connect(gain)
      oscillator.start(start)
      oscillator.stop(start + 0.09)
    }

    // A short swell and fall, so it reads as a chime rather than a beep.
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  } catch {
    // Audio is a courtesy; never let it break message delivery.
  }
}
