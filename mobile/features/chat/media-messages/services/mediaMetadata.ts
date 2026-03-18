import { Platform } from "react-native";

import type {
  RecordedVideoNoteMessage,
  RecordedVoiceMessage,
  VideoNoteMessageMetadataJson,
  VoiceMessageMetadataJson,
} from "@/features/chat/media-messages/types";

const clampWaveformValue = (value: number): number => Math.max(0, Math.min(1, value));

const extractWaveform = (samples: Float32Array, bucketCount = 36): number[] => {
  if (samples.length === 0 || bucketCount <= 0) {
    return [];
  }
  const step = Math.max(1, Math.floor(samples.length / bucketCount));
  const waveform: number[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const start = index * step;
    const end = Math.min(samples.length, start + step);
    if (start >= end) {
      waveform.push(0);
      continue;
    }
    let total = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      total += Math.abs(samples[cursor] ?? 0);
    }
    const normalized = clampWaveformValue(total / (end - start));
    waveform.push(Math.round(normalized * 100));
  }
  return waveform;
};

const getWebAudioMetadata = async (blob: Blob): Promise<{ durationMs?: number; waveform?: number[] }> => {
  const audioContextCtor = (globalThis as { AudioContext?: new () => { decodeAudioData: (input: ArrayBuffer) => Promise<{
    duration: number;
    getChannelData: (index: number) => Float32Array;
  }>; close: () => Promise<void> } }).AudioContext;
  if (typeof window === "undefined" || !audioContextCtor) {
    return {};
  }
  const context = new audioContextCtor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const firstChannel = decoded.getChannelData(0);
    return {
      durationMs: Math.round(decoded.duration * 1000),
      waveform: extractWaveform(firstChannel),
    };
  } finally {
    await context.close();
  }
};

const getVideoMetadataFromUri = async (
  uri: string,
): Promise<{ durationMs?: number; width?: number; height?: number; thumbnailUrl?: string }> =>
  new Promise((resolve) => {
    const doc = (globalThis as { document?: { createElement: (tag: string) => {
      preload: string;
      muted: boolean;
      src: string;
      duration: number;
      videoWidth: number;
      videoHeight: number;
      onloadedmetadata: (() => void) | null;
      onerror: (() => void) | null;
    } } }).document;
    if (!doc) {
      resolve({});
      return;
    }
    const video = doc.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = uri;
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined;
      const width = Number.isFinite(video.videoWidth) ? video.videoWidth : undefined;
      const height = Number.isFinite(video.videoHeight) ? video.videoHeight : undefined;
      resolve({
        durationMs,
        width,
        height,
      });
    };
    video.onerror = () => {
      resolve({});
    };
  });

export const createVoiceMetadata = async (recorded: RecordedVoiceMessage): Promise<VoiceMessageMetadataJson> => {
  const metadata: VoiceMessageMetadataJson = {
    duration_ms: recorded.durationMs,
    codec: recorded.mimeType,
  };
  if (Platform.OS !== "web" || !recorded.webFile) {
    return metadata;
  }
  try {
    const webMetadata = await getWebAudioMetadata(recorded.webFile);
    return {
      ...metadata,
      duration_ms: webMetadata.durationMs ?? metadata.duration_ms,
      waveform: webMetadata.waveform,
    };
  } catch {
    return metadata;
  }
};

export const createVideoNoteMetadata = async (
  recorded: RecordedVideoNoteMessage,
): Promise<VideoNoteMessageMetadataJson> => {
  const metadata: VideoNoteMessageMetadataJson = {
    duration_ms: recorded.durationMs,
    width: recorded.width,
    height: recorded.height,
    fps: recorded.fps,
    thumbnail_url: recorded.thumbnailUrl,
  };
  if (Platform.OS !== "web") {
    return metadata;
  }
  try {
    const webMetadata = await getVideoMetadataFromUri(recorded.uri);
    return {
      ...metadata,
      duration_ms: webMetadata.durationMs ?? metadata.duration_ms,
      width: webMetadata.width ?? metadata.width,
      height: webMetadata.height ?? metadata.height,
      thumbnail_url: webMetadata.thumbnailUrl ?? metadata.thumbnail_url,
    };
  } catch {
    return metadata;
  }
};
