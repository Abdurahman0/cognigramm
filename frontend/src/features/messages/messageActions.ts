"use client";

import { messagesApi } from "@/services/api";
import { useMessageStore } from "@/store/messageStore";
import { useUserStore } from "@/store/userStore";
import type { Message, MessageAttachmentInput, MessageType } from "@/types/message";
import { USE_LOCAL_MEDIA_UPLOAD } from "@/utils/constants";
import { realtimeSocketClient } from "@/websocket/socketClient";

export function generateClientMessageId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

export async function uploadAttachments(files: File[]): Promise<MessageAttachmentInput[]> {
  const uploaded: MessageAttachmentInput[] = [];
  for (const file of files) {
    if (USE_LOCAL_MEDIA_UPLOAD) {
      uploaded.push(await messagesApi.uploadLocalAttachment(file));
      continue;
    }
    const presigned = await messagesApi.createUploadUrl({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size
    });
    await messagesApi.uploadToPresignedUrl(presigned.upload_url, file, presigned.content_type);
    uploaded.push({
      bucket: presigned.bucket,
      object_key: presigned.object_key,
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      public_url: presigned.public_url || null
    });
  }
  return uploaded;
}

export async function sendMessageAction(params: {
  conversationId: number;
  content: string | null;
  type: MessageType;
  files: File[];
}): Promise<string> {
  const clientMessageId = generateClientMessageId();
  const currentUser = useUserStore.getState().currentUser;
  const now = new Date().toISOString();

  const optimisticMessage: Message = {
    id: -Math.floor(Math.random() * 1000000),
    conversation_id: params.conversationId,
    sender_id: currentUser?.id || null,
    sender: currentUser ? { id: currentUser.id, username: currentUser.username } : null,
    client_message_id: clientMessageId,
    content: params.content,
    message_type: params.type,
    status: "sent",
    delivery_state: "queued",
    attachments: [],
    queued_at: now,
    persisted_at: null,
    delivered_at: null,
    read_at: null,
    delivery_updated_at: now,
    created_at: now,
    edited_at: null,
    deleted_at: null,
    local_state: "pending"
  };

  useMessageStore.getState().upsertMessage(params.conversationId, optimisticMessage);

  const attachments = params.files.length > 0 ? await uploadAttachments(params.files) : [];

  realtimeSocketClient.send("send_message", {
    conversation_id: params.conversationId,
    content: params.content,
    type: params.type,
    client_message_id: clientMessageId,
    attachments
  });

  return clientMessageId;
}
