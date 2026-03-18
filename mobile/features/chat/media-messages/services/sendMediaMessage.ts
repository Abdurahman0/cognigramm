import type {
  MediaMessageMetadataJson,
  MediaMessageType,
  PreparedMediaDraft,
  RecordedVideoNoteMessage,
  RecordedVoiceMessage,
} from "@/features/chat/media-messages/types";
import type { MessageType } from "@/types";
import type { FileAttachment } from "@/types";
import { createId } from "@/utils/ids";

type SendStateCreator = (payload: {
  chatId: string;
  body: string | null;
  type: MessageType;
  attachment?: FileAttachment;
  clientMessageId?: string;
}) => Promise<void>;

const formatFileSize = (sizeBytes?: number): string => {
  if (!sizeBytes || Number.isNaN(sizeBytes)) {
    return "Unknown size";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toAttachment = (
  recorded: RecordedVoiceMessage | RecordedVideoNoteMessage,
  metadataJson: MediaMessageMetadataJson,
): FileAttachment => ({
  id: createId("attachment"),
  name: recorded.fileName,
  sizeLabel: formatFileSize(recorded.sizeBytes),
  sizeBytes: recorded.sizeBytes,
  mimeType: recorded.mimeType,
  uri: recorded.uri,
  webFile: recorded.webFile,
  originalName: recorded.fileName,
  publicUrl: null,
  metadataJson,
});

export const createPreparedMediaDraft = (
  type: MediaMessageType,
  recorded: RecordedVoiceMessage | RecordedVideoNoteMessage,
  metadataJson: MediaMessageMetadataJson,
): PreparedMediaDraft => ({
  type,
  attachment: toAttachment(recorded, metadataJson),
  metadataJson,
  previewUrl: recorded.uri,
  durationMs: metadataJson.duration_ms ?? 0,
});

export const sendMediaMessage = async (
  params: {
    chatId: string;
    draft: PreparedMediaDraft;
  },
  sendMessage: SendStateCreator,
): Promise<string> => {
  const clientMessageId = createId(params.draft.type === "voice" ? "voice" : "vnote");
  await sendMessage({
    chatId: params.chatId,
    body: null,
    type: params.draft.type,
    attachment: params.draft.attachment,
    clientMessageId,
  });
  return clientMessageId;
};
