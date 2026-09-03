import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { AppText } from "@/components/ui/AppText";
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

/** Messages-style conversation row: unread dot, avatar, two-line preview, timestamp. */
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
  const preview = typing ? "typing…" : resolveMessagePreview(lastMessage);
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
          paddingVertical: compactMode ? 8 : 10,
          backgroundColor: active
            ? theme.colors.accentMuted
            : pressed
            ? theme.colors.fillSecondary
            : hovered
            ? theme.colors.fillTertiary
            : "transparent"
        }
      ]}
    >
      <View style={styles.unreadSlot}>
        {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.accent }]} /> : null}
      </View>

      <Avatar
        uri={peer?.avatar ?? chat.avatar}
        name={peer?.fullName ?? chat.title}
        size={compactMode ? 44 : 52}
        shape={chat.kind === "group" ? "squircle" : "circle"}
        showOnlineDot={chat.kind === "direct"}
        isOnline={peer?.isOnline}
      />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <AppText variant={unread ? "bodyEmphasized" : "body"} numberOfLines={1} style={styles.title}>
            {chat.title}
          </AppText>
          <AppText variant="footnote" tone="tertiary">
            {timeLabel}
          </AppText>
        </View>
        <View style={styles.bottomLine}>
          {isOwnLastMessage && !typing && lastMessage ? (
            <Feather
              name={STATUS_ICON[lastMessage.status]}
              size={13}
              color={lastMessage.status === "seen" ? theme.colors.accent : theme.colors.textMuted}
            />
          ) : null}
          <AppText
            variant="subhead"
            tone={typing ? "accent" : "secondary"}
            numberOfLines={2}
            style={styles.preview}
          >
            {preview}
          </AppText>
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
    gap: 10,
    paddingLeft: 4,
    paddingRight: 12
  },
  unreadSlot: {
    alignItems: "center",
    width: 12
  },
  unreadDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  body: {
    flex: 1,
    gap: 2
  },
  topLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  title: {
    flex: 1
  },
  bottomLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6
  },
  preview: {
    flex: 1
  }
});
