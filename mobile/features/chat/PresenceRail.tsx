import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppToast } from "@/hooks/useAppToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

interface PresenceRailProps {
  /** Called after a direct conversation with the tapped colleague is ready. */
  onOpenConversation: (chatId: string) => void;
  limit?: number;
}

/** Horizontal strip of available colleagues, one tap from a direct conversation. */
export function PresenceRail({ onOpenConversation, limit = 14 }: PresenceRailProps): JSX.Element | null {
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const currentUser = useCurrentUser();
  const { users, startDirectConversation } = useChatStore(
    useShallow((state) => ({
      users: state.users,
      startDirectConversation: state.startDirectConversation
    }))
  );

  const people = useMemo(() => {
    return users
      .filter((user) => user.id !== currentUser.id)
      .sort((left, right) => Number(right.isOnline) - Number(left.isOnline))
      .slice(0, limit);
  }, [currentUser.id, limit, users]);

  if (people.length === 0) {
    return null;
  }

  const openDirectChat = async (userId: string) => {
    try {
      const chatId = await startDirectConversation(userId);
      onOpenConversation(chatId);
    } catch (error) {
      toast.error("Unable to open chat", error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.root}
    >
      {people.map((person) => {
        const firstName = person.fullName.split(" ")[0] ?? person.fullName;
        return (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`Message ${person.fullName}`}
            onPress={() => {
              openDirectChat(person.id).catch(() => undefined);
            }}
            style={({ pressed, hovered }) => [
              styles.person,
              {
                borderRadius: theme.radius.md,
                backgroundColor: hovered ? theme.colors.glassHover : "transparent",
                opacity: pressed ? 0.85 : 1
              }
            ]}
          >
            <Avatar
              uri={person.avatar}
              name={person.fullName}
              size={50}
              ring
              ringColor={person.isOnline ? theme.colors.online : theme.colors.glassBorder}
              showOnlineDot
              isOnline={person.isOnline}
            />
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.textSecondary }]}>
              {firstName}
            </Text>
          </Pressable>
        );
      })}
      <View style={styles.tailSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 0
  },
  content: {
    alignItems: "flex-start",
    gap: 4,
    paddingVertical: 2
  },
  person: {
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
    width: 66
  },
  name: {
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 58,
    textAlign: "center"
  },
  tailSpacer: {
    width: 4
  }
});
