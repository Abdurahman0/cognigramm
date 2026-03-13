import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import type { ChatMessage, ChatSummary, User } from "@/types";
import { formatChatTimestamp } from "@/utils/date";
import { resolveMessagePreview } from "@/utils/message";

interface ChatListItemProps {
  chat: ChatSummary;
  lastMessage?: ChatMessage;
  active?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

const getDirectPeer = (chat: ChatSummary, users: User[], currentUserId: string): User | undefined => {
  if (chat.kind !== "direct") {
    return undefined;
  }
  const peerId = chat.memberIds.find((memberId) => memberId !== currentUserId);
  return users.find((user) => user.id === peerId);
};

export function ChatListItem({
  chat,
  lastMessage,
  active = false,
  onPress,
  onLongPress
}: ChatListItemProps): JSX.Element {
  const { theme } = useAppTheme();
  const currentUser = useCurrentUser();
  const users = useChatStore((state) => state.users);
  const peer = getDirectPeer(chat, users, currentUser.id);
  const preview = chat.typingUserIds.length > 0 ? "Typing..." : resolveMessagePreview(lastMessage);
  const timeLabel = lastMessage ? formatChatTimestamp(lastMessage.createdAt) : "";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.root,
        {
          borderColor: active ? theme.colors.accent : theme.colors.border,
          backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
          opacity: pressed ? 0.92 : 1
        }
      ]}
    >
      <Avatar
        uri={peer?.avatar ?? chat.avatar}
        name={peer?.fullName ?? chat.title}
        showOnlineDot={chat.kind === "direct"}
        isOnline={peer?.isOnline}
      />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
            {chat.title}
          </Text>
          <Text style={[styles.time, { color: theme.colors.textMuted }]}>{timeLabel}</Text>
        </View>
        <View style={styles.bottomLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.preview,
              {
                color: chat.typingUserIds.length > 0 ? theme.colors.accent : theme.colors.textSecondary
              }
            ]}
          >
            {preview}
          </Text>
          <View style={styles.flags}>
            {chat.pinned ? <Feather name="bookmark" size={14} color={theme.colors.textMuted} /> : null}
            {chat.muted ? <Feather name="bell-off" size={14} color={theme.colors.textMuted} /> : null}
            {chat.unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
                <Text style={styles.badgeText}>{chat.unreadCount > 9 ? "9+" : chat.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  body: {
    flex: 1,
    gap: 5
  },
  topLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    marginRight: 8
  },
  time: {
    fontSize: 12
  },
  bottomLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  preview: {
    flex: 1,
    fontSize: 13,
    marginRight: 8
  },
  flags: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  badge: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700"
  }
});
