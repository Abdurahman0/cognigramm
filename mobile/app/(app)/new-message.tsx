import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, AppInput, Avatar, EmptyState, SearchBar, SectionHeader } from "@/components/common";
import { DetailScreenShell } from "@/components/layout";
import { Chip, IconButton } from "@/components/ui";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppToast } from "@/hooks/useAppToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

type ComposeMode = "direct" | "group";

const MODES: { key: ComposeMode; label: string }[] = [
  { key: "direct", label: "Direct" },
  { key: "group", label: "Group" }
];

export default function NewMessageScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const currentUser = useCurrentUser();

  const { users, startDirectConversation, createGroupConversation } = useChatStore(
    useShallow((state) => ({
      users: state.users,
      startDirectConversation: state.startDirectConversation,
      createGroupConversation: state.createGroupConversation
    }))
  );

  const [mode, setMode] = useState<ComposeMode>("direct");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");

  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => {
        if (!normalized) {
          return true;
        }
        return (
          user.fullName.toLowerCase().includes(normalized) ||
          user.department.toLowerCase().includes(normalized) ||
          user.role.toLowerCase().includes(normalized)
        );
      });
  }, [users, currentUser.id, query]);

  const toggleSelection = (userId: string) => {
    if (mode === "direct") {
      setSelectedIds([userId]);
      return;
    }
    setSelectedIds((state) =>
      state.includes(userId) ? state.filter((id) => id !== userId) : [...state, userId]
    );
  };

  const handleCreate = async () => {
    try {
      if (mode === "direct") {
        const first = selectedIds[0];
        if (!first) {
          toast.error("Select a colleague");
          return;
        }
        const id = await startDirectConversation(first);
        router.replace({ pathname: "/(app)/chat/[chatId]", params: { chatId: id } });
        return;
      }

      if (!title.trim() || selectedIds.length === 0) {
        toast.error("Add title and members");
        return;
      }
      const id = await createGroupConversation({
        title: title.trim(),
        memberIds: selectedIds
      });
      toast.success("Group created");
      router.replace({ pathname: "/(app)/chat/[chatId]", params: { chatId: id } });
    } catch (error) {
      toast.error("Unable to create conversation", error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <DetailScreenShell maxWidth={720}>
      <View style={styles.root}>
        <View style={styles.header}>
          <SectionHeader
            title="New conversation"
            subtitle={mode === "direct" ? "Message a colleague" : "Create a group space"}
            rightSlot={
              <IconButton icon="x" accessibilityLabel="Close" tone="plain" onPress={() => router.back()} />
            }
          />
        </View>

        <View style={styles.controls}>
          <View style={styles.modeRow}>
            {MODES.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                active={mode === item.key}
                onPress={() => {
                  setMode(item.key);
                  setSelectedIds([]);
                }}
              />
            ))}
          </View>

          {mode === "group" ? (
            <AppInput
              value={title}
              onChangeText={setTitle}
              placeholder="Group name"
              accessibilityLabel="Group name"
            />
          ) : null}

          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search colleagues"
          />
        </View>

        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState title="No colleagues found" description="Try a different search term." icon="users" />
          }
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleSelection(item.id)}
                style={({ pressed, hovered }) => [
                  styles.row,
                  {
                    borderRadius: theme.radius.lg,
                    backgroundColor: selected
                      ? theme.colors.accentMuted
                      : hovered
                      ? theme.colors.glassHover
                      : theme.colors.glassSoft,
                    opacity: pressed ? 0.9 : 1
                  }
                ]}
              >
                <Avatar uri={item.avatar} name={item.fullName} size={44} showOnlineDot isOnline={item.isOnline} />
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={[styles.name, { color: theme.colors.textPrimary }]}>
                    {item.fullName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.textMuted }]}>
                    {ROLE_LABELS[item.role]} · {item.department}
                  </Text>
                </View>
                {selected ? <Feather name="check-circle" size={19} color={theme.colors.accent} /> : null}
              </Pressable>
            );
          }}
        />

        <View style={styles.footer}>
          <AppButton
            label={mode === "direct" ? "Start chat" : `Create group (${selectedIds.length})`}
            onPress={() => {
              handleCreate().catch(() => undefined);
            }}
          />
        </View>
      </View>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14
  },
  controls: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  list: {
    flex: 1,
    marginTop: 10
  },
  listContent: {
    paddingBottom: 12,
    paddingHorizontal: 12
  },
  separator: {
    height: 8
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 12
  },
  rowCopy: {
    flex: 1,
    gap: 3
  },
  name: {
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    fontSize: 12
  },
  footer: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 8
  }
});
