import type { ApiMessageAttachmentIn } from "@/services/api";
import type { FileAttachment } from "@/types";

export type MediaMessageType = "voice" | "video_note";

export interface VoiceMessageMetadataJson {
  duration_ms?: number;
  waveform?: number[];
  codec?: string;
}

export interface VideoNoteMessageMetadataJson {
  duration_ms?: number;
  width?: number;
  height?: number;
  fps?: number;
  thumbnail_url?: string;
}

export type MediaMessageMetadataJson = VoiceMessageMetadataJson | VideoNoteMessageMetadataJson;

export interface UploadMediaMessageResponse {
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string | null;
}

export interface MediaMessageAttachmentInput extends Omit<ApiMessageAttachmentIn, "metadata_json"> {
  metadata_json?: Record<string, unknown> | null;
}

export interface LocalRecordedMediaFile {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  webFile?: Blob;
}

export interface RecordedVoiceMessage extends LocalRecordedMediaFile {
  durationMs: number;
  waveform?: number[];
  codec?: string;
}

export interface RecordedVideoNoteMessage extends LocalRecordedMediaFile {
  durationMs: number;
  width?: number;
  height?: number;
  fps?: number;
  thumbnailUrl?: string;
}

export type RecordingStep = "idle" | "requesting_permission" | "recording" | "stopping" | "ready" | "error";
export type UploadStep = "idle" | "uploading" | "uploaded" | "failed";
export type SendStep = "idle" | "sending" | "queued" | "persisted" | "failed";

export interface RecorderState<TRecorded> {
  step: RecordingStep;
  errorMessage?: string;
  recorded?: TRecorded;
}

export interface UploadState {
  step: UploadStep;
  errorMessage?: string;
}

export interface SendState {
  step: SendStep;
  errorMessage?: string;
  clientMessageId?: string;
}

export interface OptimisticMediaMessageState {
  clientMessageId: string;
  type: MediaMessageType;
  recording: RecorderState<RecordedVoiceMessage | RecordedVideoNoteMessage>;
  upload: UploadState;
  send: SendState;
}

export interface PreparedMediaDraft {
  type: MediaMessageType;
  attachment: FileAttachment;
  metadataJson: MediaMessageMetadataJson;
  previewUrl: string;
  durationMs: number;
}

export interface VideoNoteStartResult {
  requiresStop: boolean;
  recorded?: RecordedVideoNoteMessage;
}
