import type { RecordedVideoNoteMessage, RecordedVoiceMessage, VideoNoteStartResult } from "@/features/chat/media-messages/types";

type BrowserMediaRecorder = {
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: (timeslice?: number) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
};
type BrowserVideoTrack = {
  stop: () => void;
  getSettings?: () => { width?: number; height?: number; torch?: boolean };
  getCapabilities?: () => { torch?: boolean };
  applyConstraints?: (constraints: { advanced?: { torch?: boolean }[] }) => Promise<void>;
};
type BrowserMediaStream = {
  getTracks: () => { stop: () => void }[];
  getVideoTracks: () => BrowserVideoTrack[];
};

let voiceRecorder: BrowserMediaRecorder | null = null;
let voiceStream: BrowserMediaStream | null = null;
let voiceChunks: BlobPart[] = [];
let voiceStartedAt = 0;

let videoRecorder: BrowserMediaRecorder | null = null;
let videoStream: BrowserMediaStream | null = null;
let videoChunks: BlobPart[] = [];
let videoStartedAt = 0;

/**
 * The recorder is wired to a canvas rather than straight to the camera.
 *
 * MediaRecorder binds to the tracks it was handed and cannot swap them, so recording the
 * camera directly makes switching to the back camera impossible without losing the take.
 * Drawing whichever camera is live into a canvas and recording *that* means the flip is
 * just a change of what gets drawn — the recording never notices.
 */
let cameraStream: MediaStream | null = null;
let cameraVideoEl: HTMLVideoElement | null = null;
let cameraCanvas: HTMLCanvasElement | null = null;
let drawHandle: number | null = null;
let facingMode: "user" | "environment" = "user";

/** Notes are round, so the canvas is square and the camera is centre-cropped into it. */
const CAPTURE_SIZE = 480;

const openCamera = (mode: "user" | "environment"): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: mode } });

const startDrawLoop = (): void => {
  const canvas = cameraCanvas;
  const source = cameraVideoEl;
  const context = canvas?.getContext("2d");
  if (!canvas || !source || !context) {
    return;
  }
  const draw = () => {
    const width = source.videoWidth;
    const height = source.videoHeight;
    if (width > 0 && height > 0) {
      const side = Math.min(width, height);
      context.drawImage(
        source,
        (width - side) / 2,
        (height - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
    drawHandle = requestAnimationFrame(draw);
  };
  drawHandle = requestAnimationFrame(draw);
};

const teardownCapture = (): void => {
  if (drawHandle !== null) {
    cancelAnimationFrame(drawHandle);
    drawHandle = null;
  }
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (cameraVideoEl) {
    cameraVideoEl.srcObject = null;
    cameraVideoEl = null;
  }
  cameraCanvas = null;
  facingMode = "user";
};

const ensureMediaRecorderSupport = (): void => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new Error("Recording is unavailable in this environment.");
  }
  const recorderCtor = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  if (typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof recorderCtor !== "function") {
    throw new Error("Your browser does not support recording.");
  }
};

const pickSupportedMimeType = (candidates: string[], fallback: string): string => {
  const recorderCtor = (globalThis as { MediaRecorder?: { isTypeSupported?: (value: string) => boolean } }).MediaRecorder;
  if (!recorderCtor || typeof recorderCtor.isTypeSupported !== "function") {
    return fallback;
  }
  const supported = candidates.find((candidate) => recorderCtor.isTypeSupported?.(candidate));
  return supported ?? fallback;
};

const getMediaRecorderConstructor = (): (new (stream: BrowserMediaStream, options?: { mimeType?: string }) => BrowserMediaRecorder) => {
  const ctor = (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  if (typeof ctor !== "function") {
    throw new Error("Your browser does not support recording.");
  }
  return ctor as new (stream: BrowserMediaStream, options?: { mimeType?: string }) => BrowserMediaRecorder;
};

const stopTracks = (stream: BrowserMediaStream | null): void => {
  stream?.getTracks().forEach((track) => track.stop());
};

const stopRecorder = (recorder: BrowserMediaRecorder | null): Promise<void> =>
  new Promise((resolve) => {
    if (!recorder || recorder.state === "inactive") {
      resolve();
      return;
    }
    recorder.onstop = () => resolve();
    recorder.stop();
  });

const buildFileName = (prefix: "voice" | "video-note", extension: "webm" | "mp4"): string =>
  `${prefix}-${Date.now()}.${extension}`;

export const startVoiceRecording = async (): Promise<void> => {
  ensureMediaRecorderSupport();
  if (voiceRecorder && voiceRecorder.state !== "inactive") {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickSupportedMimeType(
    ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"],
    "audio/webm",
  );
  const MediaRecorderCtor = getMediaRecorderConstructor();
  const recorder = new MediaRecorderCtor(stream as BrowserMediaStream, { mimeType });
  voiceChunks = [];
  voiceStartedAt = Date.now();
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      voiceChunks.push(event.data);
    }
  };
  recorder.start(250);
  voiceRecorder = recorder;
  voiceStream = stream as unknown as BrowserMediaStream;
};

export const stopVoiceRecording = async (): Promise<RecordedVoiceMessage> => {
  if (!voiceRecorder) {
    throw new Error("Voice recorder is not running.");
  }
  await stopRecorder(voiceRecorder);
  const recorder = voiceRecorder;
  const stream = voiceStream;
  voiceRecorder = null;
  voiceStream = null;
  stopTracks(stream);

  const mimeType = recorder.mimeType || "audio/webm";
  const blob = new Blob(voiceChunks, { type: mimeType });
  voiceChunks = [];
  const uri = URL.createObjectURL(blob);
  const durationMs = Math.max(Date.now() - voiceStartedAt, 0);
  return {
    uri,
    fileName: buildFileName("voice", "webm"),
    mimeType,
    sizeBytes: blob.size,
    webFile: blob,
    durationMs,
  };
};

export const cancelVoiceRecording = async (): Promise<void> => {
  if (voiceRecorder) {
    await stopRecorder(voiceRecorder);
  }
  stopTracks(voiceStream);
  voiceRecorder = null;
  voiceStream = null;
  voiceChunks = [];
};

export const startVideoNoteRecording = async (): Promise<VideoNoteStartResult> => {
  ensureMediaRecorderSupport();
  if (videoRecorder && videoRecorder.state !== "inactive") {
    return { requiresStop: true };
  }

  facingMode = "user";
  cameraStream = await openCamera(facingMode);

  cameraVideoEl = document.createElement("video");
  cameraVideoEl.srcObject = cameraStream;
  cameraVideoEl.muted = true;
  cameraVideoEl.playsInline = true;
  await cameraVideoEl.play().catch(() => undefined);

  cameraCanvas = document.createElement("canvas");
  cameraCanvas.width = CAPTURE_SIZE;
  cameraCanvas.height = CAPTURE_SIZE;
  startDrawLoop();

  const captured = cameraCanvas.captureStream(30);
  cameraStream.getAudioTracks().forEach((track) => captured.addTrack(track));

  const mimeType = pickSupportedMimeType(
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"],
    "video/webm",
  );
  const MediaRecorderCtor = getMediaRecorderConstructor();
  const recorder = new MediaRecorderCtor(captured as unknown as BrowserMediaStream, { mimeType });
  videoChunks = [];
  videoStartedAt = Date.now();
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      videoChunks.push(event.data);
    }
  };
  recorder.start(250);
  videoRecorder = recorder;
  videoStream = captured as unknown as BrowserMediaStream;
  return { requiresStop: true };
};

/** True where more than one camera is available to turn to. */
export const canSwitchCamera = (): boolean => Boolean(cameraStream);

/**
 * Turns the camera around mid-take. Only the source feeding the canvas changes, so the
 * recording continues uninterrupted and the microphone track is never disturbed.
 */
export const switchVideoNoteCamera = async (): Promise<boolean> => {
  if (!cameraStream || !cameraVideoEl) {
    return false;
  }
  const next = facingMode === "user" ? "environment" : "user";
  let replacement: MediaStream;
  try {
    replacement = await openCamera(next);
  } catch {
    return false;
  }

  const previousVideoTracks = cameraStream.getVideoTracks();
  cameraVideoEl.srcObject = replacement;
  await cameraVideoEl.play().catch(() => undefined);
  previousVideoTracks.forEach((track) => track.stop());
  // The take already has its microphone; a second one would double the audio.
  replacement.getAudioTracks().forEach((track) => track.stop());
  cameraStream = replacement;
  facingMode = next;
  return true;
};

export const getFacingMode = (): "user" | "environment" => facingMode;

export const stopVideoNoteRecording = async (): Promise<RecordedVideoNoteMessage> => {
  if (!videoRecorder) {
    throw new Error("Video note recorder is not running.");
  }
  await stopRecorder(videoRecorder);
  const recorder = videoRecorder;
  const stream = videoStream;
  videoRecorder = null;
  videoStream = null;
  const firstVideoTrack = stream?.getVideoTracks()[0];
  const settings = typeof firstVideoTrack?.getSettings === "function" ? firstVideoTrack.getSettings() : undefined;
  stopTracks(stream);
  teardownCapture();

  const mimeType = recorder.mimeType || "video/webm";
  const blob = new Blob(videoChunks, { type: mimeType });
  videoChunks = [];
  const uri = URL.createObjectURL(blob);
  const durationMs = Math.max(Date.now() - videoStartedAt, 0);
  return {
    uri,
    fileName: buildFileName("video-note", "webm"),
    mimeType,
    sizeBytes: blob.size,
    webFile: blob,
    durationMs,
    width: typeof settings?.width === "number" ? settings.width : undefined,
    height: typeof settings?.height === "number" ? settings.height : undefined,
  };
};

/**
 * The live capture stream, so the composer can show what is being filmed rather than an
 * opaque "recording" label. Returned as `unknown` because the caller hands it straight to
 * a `<video>` element and never inspects it.
 */
export const getVideoNotePreviewStream = (): unknown => videoStream;

/** Pausing keeps the take: resume appends to the same recording. */
export const pauseRecording = (kind: "voice" | "video_note"): boolean => {
  const recorder = kind === "voice" ? voiceRecorder : videoRecorder;
  if (!recorder || recorder.state !== "recording") {
    return false;
  }
  recorder.pause();
  return true;
};

export const resumeRecording = (kind: "voice" | "video_note"): boolean => {
  const recorder = kind === "voice" ? voiceRecorder : videoRecorder;
  if (!recorder || recorder.state !== "paused") {
    return false;
  }
  recorder.resume();
  return true;
};

/** Only some cameras expose a torch, so this reports whether the control is real. */
export const supportsTorch = (): boolean => {
  // The torch belongs to the camera, not the canvas the recorder is reading.
  const track = cameraStream?.getVideoTracks()[0] as BrowserVideoTrack | undefined;
  return Boolean(track?.getCapabilities?.().torch);
};

export const setTorch = async (enabled: boolean): Promise<boolean> => {
  const track = cameraStream?.getVideoTracks()[0] as BrowserVideoTrack | undefined;
  if (!track?.getCapabilities?.().torch || !track.applyConstraints) {
    return false;
  }
  try {
    await track.applyConstraints({ advanced: [{ torch: enabled }] });
    return true;
  } catch {
    return false;
  }
};

export const cancelVideoNoteRecording = async (): Promise<void> => {
  if (videoRecorder) {
    await stopRecorder(videoRecorder);
  }
  stopTracks(videoStream);
  teardownCapture();
  videoRecorder = null;
  videoStream = null;
  videoChunks = [];
};
