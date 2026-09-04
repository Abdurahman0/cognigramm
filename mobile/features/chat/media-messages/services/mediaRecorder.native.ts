import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";

import type { RecordedVideoNoteMessage, RecordedVoiceMessage, VideoNoteStartResult } from "@/features/chat/media-messages/types";

let activeVoiceRecording: Audio.Recording | null = null;

const ensureMicrophonePermission = async (): Promise<void> => {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Microphone permission denied.");
  }
};

const getNativeFileSize = async (uri: string): Promise<number | undefined> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return undefined;
  }
};

export const startVoiceRecording = async (): Promise<void> => {
  if (activeVoiceRecording) {
    return;
  }
  await ensureMicrophonePermission();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  activeVoiceRecording = recording;
};

export const stopVoiceRecording = async (): Promise<RecordedVoiceMessage> => {
  if (!activeVoiceRecording) {
    throw new Error("Voice recorder is not running.");
  }
  const recording = activeVoiceRecording;
  activeVoiceRecording = null;
  await recording.stopAndUnloadAsync();
  const status = await recording.getStatusAsync();
  const durationMs = "durationMillis" in status && typeof status.durationMillis === "number" ? status.durationMillis : 0;
  const uri = recording.getURI();
  if (!uri) {
    throw new Error("Recorded audio file is unavailable.");
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  return {
    uri,
    fileName: `voice-${Date.now()}.m4a`,
    mimeType: "audio/mp4",
    sizeBytes: await getNativeFileSize(uri),
    durationMs,
  };
};

export const cancelVoiceRecording = async (): Promise<void> => {
  if (!activeVoiceRecording) {
    return;
  }
  const recording = activeVoiceRecording;
  activeVoiceRecording = null;
  try {
    await recording.stopAndUnloadAsync();
  } catch {
    // no-op
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
};

const ensureVideoPermissions = async (): Promise<void> => {
  const [camera, microphone] = await Promise.all([
    ImagePicker.requestCameraPermissionsAsync(),
    Audio.requestPermissionsAsync(),
  ]);
  if (!camera.granted) {
    throw new Error("Camera permission denied.");
  }
  if (!microphone.granted) {
    throw new Error("Microphone permission denied.");
  }
};

export const startVideoNoteRecording = async (): Promise<VideoNoteStartResult> => {
  await ensureVideoPermissions();
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: false,
    quality: 0.7,
    videoMaxDuration: 60,
  });
  if (result.canceled || result.assets.length === 0) {
    throw new Error("Video note recording canceled.");
  }
  const asset = result.assets[0];
  if (!asset?.uri) {
    throw new Error("Recorded video file is unavailable.");
  }
  return {
    requiresStop: false,
    recorded: {
      uri: asset.uri,
      fileName: asset.fileName ?? `video-note-${Date.now()}.mp4`,
      mimeType: asset.mimeType ?? "video/mp4",
      sizeBytes: asset.fileSize,
      durationMs: typeof asset.duration === "number" ? asset.duration : 0,
      width: asset.width,
      height: asset.height,
    },
  };
};

export const stopVideoNoteRecording = async (): Promise<RecordedVideoNoteMessage> => {
  throw new Error("Video note recording is completed from the native camera flow.");
};

export const cancelVideoNoteRecording = async (): Promise<void> => {
  return Promise.resolve();
};

/**
 * The native video note is captured by the system camera UI, which owns its own preview,
 * pause and torch. Nothing here can drive them, so these report honestly rather than
 * pretending, and the composer hides the controls they would have driven.
 */
export const getVideoNotePreviewStream = (): unknown => null;

export const pauseRecording = (): boolean => false;

export const resumeRecording = (): boolean => false;

export const supportsTorch = (): boolean => false;

export const setTorch = async (): Promise<boolean> => false;

export const canSwitchCamera = (): boolean => false;

export const switchVideoNoteCamera = async (): Promise<boolean> => false;

export const getFacingMode = (): "user" | "environment" => "user";
