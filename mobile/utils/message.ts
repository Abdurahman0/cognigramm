import type { ChatMessage } from "@/types";

export const resolveMessagePreview = (message?: ChatMessage): string => {
  if (!message) {
    return "No messages yet";
  }
  if (message.isDeleted) {
    return "Message deleted";
  }
  if (message.type === "image") {
    return "Shared an image";
  }
  if (message.type === "file") {
    return `Shared file: ${message.attachment?.name ?? "Document"}`;
  }
  if (message.type === "voice") {
    return "Voice note";
  }
  if (message.type === "video_note") {
    return "Video note";
  }
  if (message.type === "system") {
    return message.body;
  }
  return message.body;
};
