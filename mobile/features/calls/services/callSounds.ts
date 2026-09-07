import { Audio } from "expo-av";

/**
 * The two sounds a call makes before it connects.
 *
 * `incoming` rings this device when somebody calls; `outgoing` is the ringback
 * heard while the far end is being rung. Both loop until the call is answered,
 * declined or cancelled, so every path out of a ringing state has to stop them.
 *
 * Shared by both platforms deliberately: the same call should sound the same
 * whichever client it reaches.
 */
const SOURCES = {
  incoming: require("../../../assets/sounds/incoming-call.mp3"),
  outgoing: require("../../../assets/sounds/outgoing-call.mp3")
} as const;

export type CallSoundKind = keyof typeof SOURCES;

/** Loud enough to hear across a room, quiet enough not to startle. */
const VOLUME = 0.8;

let current: Audio.Sound | null = null;
/**
 * Guards the gap between asking for a sound and it finishing loading: a call
 * answered in that window must not leave a ringtone playing over it.
 */
let generation = 0;

export const stopCallSound = async (): Promise<void> => {
  generation += 1;
  const playing = current;
  current = null;
  if (!playing) {
    return;
  }
  try {
    await playing.stopAsync();
  } catch {
    // Already stopped or never started.
  }
  try {
    await playing.unloadAsync();
  } catch {
    // Nothing left to release.
  }
};

export const playCallSound = async (kind: CallSoundKind): Promise<void> => {
  await stopCallSound();
  const ticket = generation;

  try {
    const { sound } = await Audio.Sound.createAsync(SOURCES[kind], {
      shouldPlay: true,
      isLooping: true,
      volume: VOLUME
    });

    if (ticket !== generation) {
      // Stopped while this was loading.
      await sound.unloadAsync().catch(() => undefined);
      return;
    }
    current = sound;
  } catch {
    current = null;
  }
};
