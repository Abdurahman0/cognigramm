import { Platform } from "react-native";

import { messagesApi } from "@/services/api";
import { ApiRequestError } from "@/services/api/httpClient";

import type { LocalRecordedMediaFile, UploadMediaMessageResponse } from "@/features/chat/media-messages/types";

export type UploadMediaMessageErrorCode = "unauthorized" | "file_too_large" | "upload_failed";

export class UploadMediaMessageError extends Error {
  readonly code: UploadMediaMessageErrorCode;

  constructor(code: UploadMediaMessageErrorCode, message: string) {
    super(message);
    this.name = "UploadMediaMessageError";
    this.code = code;
  }
}

const mapUploadError = (error: unknown): UploadMediaMessageError => {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return new UploadMediaMessageError("unauthorized", "Session expired. Please sign in again.");
    }
    if (error.status === 413) {
      return new UploadMediaMessageError("file_too_large", "Recorded file is too large.");
    }
    return new UploadMediaMessageError("upload_failed", "Failed to upload recorded media.");
  }
  if (error instanceof UploadMediaMessageError) {
    return error;
  }
  return new UploadMediaMessageError("upload_failed", "Failed to upload recorded media.");
};

const ensureBlob = async (file: LocalRecordedMediaFile): Promise<Blob> => {
  if (file.webFile) {
    return file.webFile;
  }
  const response = await fetch(file.uri);
  return response.blob();
};

export const uploadMediaMessage = async (
  token: string,
  file: LocalRecordedMediaFile,
): Promise<UploadMediaMessageResponse> => {
  try {
    const formData = new FormData();
    if (Platform.OS === "web") {
      const blob = await ensureBlob(file);
      formData.append("file", blob, file.fileName);
    } else {
      formData.append(
        "file",
        {
          uri: file.uri,
          name: file.fileName,
          type: file.mimeType,
        } as unknown as Blob,
      );
    }
    return await messagesApi.uploadLocalAttachment(token, formData);
  } catch (error) {
    throw mapUploadError(error);
  }
};
