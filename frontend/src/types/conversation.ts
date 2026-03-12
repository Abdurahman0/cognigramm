export type ConversationType = "direct" | "group";
export type ParticipantRole = "admin" | "member";

export interface ConversationMember {
  user_id: number;
  username: string;
  role: ParticipantRole;
  joined_at: string;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  title: string | null;
  created_at: string;
  participants: ConversationMember[];
}

export interface CreateConversationPayload {
  type: ConversationType;
  title?: string | null;
  participant_ids: number[];
}
