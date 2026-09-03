import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ChatMessage, ChatSummary, DeliveryState, User } from "@/types";
import { formatChatTimestamp } from "@/utils/date";
import { resolveMessagePreview } from "@/utils/message";

interface ChatListItemProps {
  chat: ChatSummary;
  lastMessage?: ChatMessage;
  active?: boolean;
  onPress: () => void;
}

const STATUS_ICON: Record<DeliveryState, keyof typeof Feather.glyphMap> = {
  sending: "clock",
  sent: "check",
  delivered: "check-circle",
  seen: "eye"
};

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
  onPress
}: ChatListItemProps): JSX.Element {
  const { theme } = useAppTheme();
  const currentUser = useCurrentUser();
  const users = useChatStore((state) => state.users);
  const compactMode = useSettingsStore((state) => state.compactMode);
  const peer = getDirectPeer(chat, users, currentUser.id);
  const typing = chat.typingUserIds.length > 0;
  const preview = typing ? "Typing…" : resolveMessagePreview(lastMessage);
  const timeLabel = lastMessage ? formatChatTimestamp(lastMessage.createdAt) : "";
  const isOwnLastMessage = Boolean(lastMessage && lastMessage.senderId === currentUser.id);
  const unread = chat.unreadCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.root,
        {
          borderRadius: theme.radius.lg,
          minHeight: compactMode ? 62 : 72,
          paddingVertical: compactMode ? 8 : 11,
          backgroundColor: active
            ? theme.colors.accentMuted
            : hovered
            ? theme.colors.glassHover
            : "transparent",
          opacity: pressed ? 0.9 : 1
        }
      ]}
    >
      <Avatar
        uri={peer?.avatar ?? chat.avatar}
        name={peer?.fullName ?? chat.title}
        size={compactMode ? 40 : 48}
        shape={chat.kind === "group" ? "squircle" : "circle"}
        showOnlineDot={chat.kind === "direct"}
        isOnline={peer?.isOnline}
      />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: theme.colors.textPrimary, fontWeight: unread ? "700" : "600" }
            ]}
          >
            {chat.title}
          </Text>
          <Text style={[styles.time, { color: unread ? theme.colors.accent : theme.colors.textMuted }]}>
            {timeLabel}
          </Text>
        </View>
        <View style={styles.bottomLine}>
          {isOwnLastMessage && !typing && lastMessage ? (
            <Feather
              name={STATUS_ICON[lastMessage.status]}
              size={13}
              color={lastMessage.status === "seen" ? theme.colors.accent : theme.colors.textMuted}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.preview,
              {
                color: typing
                  ? theme.colors.online
                  : unread
                  ? theme.colors.textSecondary
                  : theme.colors.textMuted
              }
            ]}
          >
            {preview}
          </Text>
          {unread ? <Badge count={chat.unreadCount} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12
  },
  body: {
    flex: 1,
    gap: 4
  },
  topLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  title: {
    flex: 1,
    fontSize: 15,
    letterSpacing: -0.1
  },
  time: {
    fontSize: 11,
    fontWeight: "600"
  },
  bottomLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  preview: {
    flex: 1,
    fontSize: 13
  }
});
