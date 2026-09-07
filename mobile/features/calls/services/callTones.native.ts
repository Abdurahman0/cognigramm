import { playCallSound, stopCallSound } from "@/features/calls/services/callSounds";
import type { CallTones } from "@/features/calls/services/callTones";

/**
 * Native half of the call tones.
 *
 * The platform already owns these sounds — the system ringtone, the ringback the dialler
 * plays, the busy tone — and InCallManager exposes them along with the audio session and
 * vibration that should accompany a ringing phone. Synthesising our own here would ignore
 * the user's silent switch and ringtone choice, so the platform's are used instead.
 */
interface InCallManagerLike {
  start: (setup?: { auto?: boolean; media?: "video" | "audio"; ringback?: string }) => void;
  stop: (setup?: { busytone?: string }) => void;
  startRingtone: (
    ringtone: string,
    vibratePattern: number | number[],
    iosCategory: string,
    seconds: number
  ) => void;
  stopRingtone: () => void;
  startRingback: (ringback: string) => void;
  stopRingback: () => void;
}

const loadManager = (): InCallManagerLike | null => {
  try {
    const module = require("react-native-incall-manager") as {
      default?: InCallManagerLike;
    } & InCallManagerLike;
    return module.default ?? module ?? null;
  } catch {
    // The module is absent until the dev client is rebuilt with it linked.
    return null;
  }
};

class NativeCallTones implements CallTones {
  private readonly manager = loadManager();
  private ringing = false;
  private ringingBack = false;

  ringback(): void {
    if (this.ringingBack) {
      return;
    }
    this.stop();
    this.ringingBack = true;
    // The session still starts through the manager so audio routing is set up
    // for the call itself; the ringback the caller hears is our own file, so
    // the sound matches the desktop and web clients.
    try {
      this.manager?.start({ media: "audio" });
    } catch {
      // Routing is a nicety; the tone below is the part people notice.
    }
    void playCallSound("outgoing");
  }

  ringtone(): void {
    if (this.ringing) {
      return;
    }
    this.stop();
    this.ringing = true;
    try {
      // -1 vibrates on the platform's own ringer pattern; the audible part is
      // our own ringtone rather than the system one.
      this.manager?.startRingtone("", -1, "playback", 30);
    } catch {
      // Vibration is optional.
    }
    void playCallSound("incoming");
  }

  connected(): void {
    this.stop();
  }

  ended(): void {
    if (!this.manager) {
      return;
    }
    this.ringing = false;
    this.ringingBack = false;
    try {
      this.manager.stopRingtone();
      this.manager.stopRingback();
      this.manager.stop({ busytone: "_DEFAULT_" });
    } catch {
      // nothing playing
    }
  }

  /** The platform owns these tones and their level; the app does not get to scale them. */
  setLevel(): void {
    // no-op
  }

  stop(): void {
    // Our own sound first: it plays whether or not the native manager linked,
    // so an early return here would leave a ringtone running forever.
    void stopCallSound();

    try {
      if (this.ringing) {
        this.manager?.stopRingtone();
      }
      if (this.ringingBack) {
        this.manager?.stopRingback();
      }
    } catch {
      // nothing playing
    }
    this.ringing = false;
    this.ringingBack = false;
  }
}

export const callTones: CallTones = new NativeCallTones();
export type { CallTones };
