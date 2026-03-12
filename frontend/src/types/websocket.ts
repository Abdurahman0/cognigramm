import type { Message } from "@/types/message";

export type WebSocketIncomingEvent =
  | "connected"
  | "message_queued"
  | "message_persisted"
  | "message_persisted_ack"
  | "message_retrying"
  | "message_failed"
  | "message_delivered"
  | "message_read"
  | "message_delivery_state"
  | "message_edited"
  | "message_deleted"
  | "typing_start"
  | "typing_stop"
  | "user_online"
  | "user_offline"
  | "last_seen_update"
  | "missed_messages"
  | "rate_limited"
  | "error"
  | "joined_conversation"
  | "left_conversation"
  | "delivery_ack_queued"
  | "read_ack_queued"
  | "active_conversation_set";

export type WebSocketOutgoingEvent =
  | "send_message"
  | "edit_message"
  | "delete_message"
  | "delivery_ack"
  | "read_receipt"
  | "typing_start"
  | "typing_stop"
  | "join_conversation"
  | "leave_conversation"
  | "sync_missed"
  | "active_conversation";

export interface SocketEnvelope<TPayload = Record<string, unknown>> {
  event: string;
  payload: TPayload;
}

export interface MissedMessagesPayload {
  conversation_id: number;
  messages: Message[];
}
