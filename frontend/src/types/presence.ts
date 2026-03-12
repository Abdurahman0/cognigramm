export interface PresenceState {
  user_id: number;
  is_online: boolean;
  active_conversation_id: number | null;
  sessions: number;
  last_seen: string | null;
  updated_at: string | null;
}

export interface TypingState {
  conversation_id: number;
  user_ids: number[];
}
