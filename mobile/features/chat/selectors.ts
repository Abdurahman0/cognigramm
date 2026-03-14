import type { ChatFilterKey } from "@/store/chatStore";
import type { ChatMessage, ChatSummary } from "@/types";

const normalize = (value: string): string => value.trim().toLowerCase();

export const filterChats = (
  chats: ChatSummary[],
  messagesByChat: Record<string, ChatMessage[]>,
  query: string,
  filter: ChatFilterKey
): ChatSummary[] => {
  const search = normalize(query);
  return chats.filter((chat) => {
    if (filter === "unread" && chat.unreadCount === 0) return false;
    if (filter === "groups" && chat.kind !== "group") return false;

    if (!search) return true;
    const messages = messagesByChat[chat.id] ?? [];
    const last = messages[messages.length - 1]?.body ?? "";
    return normalize(chat.title).includes(search) || normalize(chat.subtitle ?? "").includes(search) || normalize(last).includes(search);
  });
};
