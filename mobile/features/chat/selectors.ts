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
    if (filter === "channels" && !["channel", "announcement"].includes(chat.kind)) return false;
    if (filter === "groups" && chat.kind !== "group") return false;
    if (filter === "archived" && !chat.archived) return false;
    if (filter === "pinned" && !chat.pinned) return false;
    if (filter !== "archived" && chat.archived) return false;

    if (!search) return true;
    const messages = messagesByChat[chat.id] ?? [];
    const last = messages[messages.length - 1]?.body ?? "";
    return normalize(chat.title).includes(search) || normalize(chat.subtitle ?? "").includes(search) || normalize(last).includes(search);
  });
};

export const searchMessages = (
  chats: ChatSummary[],
  messagesByChat: Record<string, ChatMessage[]>,
  query: string
): Array<{ chat: ChatSummary; message: ChatMessage }> => {
  const search = normalize(query);
  if (!search) {
    return [];
  }

  const rows: Array<{ chat: ChatSummary; message: ChatMessage }> = [];
  chats.forEach((chat) => {
    (messagesByChat[chat.id] ?? []).forEach((message) => {
      if (!message.isDeleted && normalize(message.body).includes(search)) {
        rows.push({ chat, message });
      }
    });
  });

  return rows.sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt));
};
