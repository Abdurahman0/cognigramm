import type { RecordedVideoNoteMessage, RecordedVoiceMessage, VideoNoteStartResult } from "@/features/chat/media-messages/types";

type BrowserMediaRecorder = {
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: (timeslice?: number) => void;
  stop: () => void;
};
type BrowserMediaStream = {
  getTracks: () => Array<{ stop: () => void }>;
  getVideoTracks: () => Array<{ getSettings?: () => { width?: number; height?: number } }>;
};

let voiceRecorder: BrowserMediaRecorder | null = null;
let voiceStream: BrowserMediaStream | null = null;
let voiceChunks: BlobPart[] = [];
let voiceStartedAt = 0;

let videoRecorder: BrowserMediaRecorder | null = null;
let videoStream: BrowserMediaStream | null = null;
let videoChunks: BlobPart[] = [];
let videoStartedAt = 0;

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
  voiceStream = stream;
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
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: "user" },
  });
  const mimeType = pickSupportedMimeType(
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"],
    "video/webm",
  );
  const MediaRecorderCtor = getMediaRecorderConstructor();
  const recorder = new MediaRecorderCtor(stream as BrowserMediaStream, { mimeType });
  videoChunks = [];
  videoStartedAt = Date.now();
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      videoChunks.push(event.data);
    }
  };
  recorder.start(250);
  videoRecorder = recorder;
  videoStream = stream;
  return { requiresStop: true };
};

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

export const cancelVideoNoteRecording = async (): Promise<void> => {
  if (videoRecorder) {
    await stopRecorder(videoRecorder);
  }
  stopTracks(videoStream);
  videoRecorder = null;
  videoStream = null;
  videoChunks = [];
};
