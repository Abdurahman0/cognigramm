/**
 * The sounds a call makes.
 *
 * A call with no audio feedback feels broken: you tap dial and nothing tells you the
 * other end is being rung, and an incoming call arrives in silence. These are the four
 * cues every phone gives you.
 *
 * This file is the web implementation, which synthesises the tones with Web Audio so no
 * audio assets ship. `callTones.native.ts` hands the same calls to the platform's own
 * telephony tones instead.
 */
export interface CallTones {
  /** Outgoing: the peer's phone is ringing. */
  ringback: () => void;
  /** Incoming: this device is being rung. */
  ringtone: () => void;
  /** Short rising blip when the media path opens. */
  connected: () => void;
  /** The busy tone that tells you the call is over, even if you were not looking. */
  ended: () => void;
  /** Silence whatever is playing. */
  stop: () => void;
  /**
   * Scales the tones to the call's output level, 0..1. Without this the fader would do
   * nothing while a call is still dialling, since there is no remote audio yet.
   */
  setLevel: (level: number) => void;
}

interface Pattern {
  freqs: number[];
  level: number;
  /** Alternating on/off durations in ms, looped. */
  segments: number[];
}

/** European ringback: one second of 425Hz, then a long gap. */
const RINGBACK: Pattern = { freqs: [425], level: 0.12, segments: [1000, 2200] };
/** Incoming: a double burst, the shape every phone has used since bell ringers. */
const RINGTONE: Pattern = { freqs: [440, 480], level: 0.1, segments: [400, 200, 400, 1800] };
/** Hang-up: the network busy tone, two beeps, then silence. */
const BUSY: Pattern = { freqs: [425], level: 0.13, segments: [220, 200, 220, 200] };

class WebCallTones implements CallTones {
  private context: AudioContext | null = null;
  private teardown: (() => void) | null = null;
  private level = 1;
  private active: { gain: GainNode; pattern: Pattern } | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    if (!this.context) {
      this.context = new Ctor();
    }
    // Browsers park the context until a gesture; dialling or answering is that gesture.
    if (this.context.state === "suspended") {
      this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  private loop(pattern: Pattern): void {
    this.stop();
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    this.active = { gain, pattern };

    const oscillators = pattern.freqs.map((frequency) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start();
      return oscillator;
    });

    const cycleMs = pattern.segments.reduce((total, segment) => total + segment, 0);

    // One pass schedules the whole cycle ahead of time, so the rhythm stays exact even
    // if the timer that repeats it drifts.
    const schedule = () => {
      const start = context.currentTime;
      gain.gain.cancelScheduledValues(start);
      gain.gain.setValueAtTime(0, start);
      let cursor = start;
      const peak = pattern.level * this.level;
      pattern.segments.forEach((segment, index) => {
        const seconds = segment / 1000;
        if (index % 2 === 0 && peak > 0) {
          gain.gain.setValueAtTime(0, cursor);
          gain.gain.linearRampToValueAtTime(peak, cursor + 0.03);
          gain.gain.setValueAtTime(peak, cursor + seconds - 0.03);
          gain.gain.linearRampToValueAtTime(0, cursor + seconds);
        }
        cursor += seconds;
      });
    };

    schedule();
    const timer = setInterval(schedule, cycleMs);

    this.teardown = () => {
      clearInterval(timer);
      oscillators.forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch {
          // already stopped
        }
        oscillator.disconnect();
      });
      gain.disconnect();
    };
  }

  private blip(from: number, to: number): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const now = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14 * this.level, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + 0.16);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
    oscillator.onended = () => {
      gain.disconnect();
    };
  }

  ringback(): void {
    this.loop(RINGBACK);
  }

  ringtone(): void {
    this.loop(RINGTONE);
  }

  connected(): void {
    this.stop();
    this.blip(600, 940);
  }

  /**
   * A single short blip is easy to miss, so hanging up plays the two-beep busy tone the
   * telephone network uses and then stops itself rather than looping forever.
   */
  ended(): void {
    this.loop(BUSY);
    const cycles = BUSY.segments.reduce((total, segment) => total + segment, 0);
    setTimeout(() => {
      this.stop();
    }, cycles * 2);
  }

  stop(): void {
    this.teardown?.();
    this.teardown = null;
    this.active = null;
  }

  setLevel(level: number): void {
    this.level = Math.max(0, Math.min(1, level));
    // Re-arm the running tone so the change is heard now rather than next cycle.
    const running = this.active;
    if (running) {
      this.loop(running.pattern);
    }
  }
}

export const callTones: CallTones = new WebCallTones();
