import type { ID } from "@/types/common";

export type SharedFileType = "image" | "document" | "spreadsheet" | "presentation" | "archive" | "voice" | "video_note";

export interface SharedFileItem {
  id: ID;
  chatId: ID;
  ownerId: ID;
  title: string;
  type: SharedFileType;
  sizeLabel: string;
  uploadedAt: string;
}
