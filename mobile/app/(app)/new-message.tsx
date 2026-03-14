import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppButton, Avatar, ScreenContainer, SearchBar, SectionHeader } from "@/components/common";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { useShallow } from "zustand/react/shallow";

type ComposeMode = "direct" | "group";

export default function NewMessageScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const currentUser = useCurrentUser();

  const { users, startDirectConversation, createGroupConversation } = useChatStore(useShallow((state) => ({
    users: state.users,
    startDirectConversation: state.startDirectConversation,
    createGroupConversation: state.createGroupConversation
  })));

  const [mode, setMode] = useState<ComposeMode>("direct");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");

  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => {
        if (!normalized) return true;
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
    setSelectedIds((state) => (state.includes(userId) ? state.filter((id) => id !== userId) : [...state, userId]));
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
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="New Conversation"
          subtitle="Start direct chats or groups"
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />
      </View>

      <View style={styles.content}>
        <View style={styles.modeTabs}>
          {([
            { key: "direct", label: "Direct" },
            { key: "group", label: "Group" }
          ] as const).map((item) => {
            const active = mode === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMode(item.key);
                  setSelectedIds([]);
                }}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={{ color: active ? "#FFFFFF" : theme.colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode !== "direct" ? (
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Group name"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.titleInput,
              Platform.OS === "web" ? styles.titleInputWeb : null,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface
              }
            ]}
          />
        ) : null}

        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Search employees" />

        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            return (
              <Pressable
                onPress={() => toggleSelection(item.id)}
                style={[
                  styles.row,
                  {
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                    backgroundColor: selected ? theme.colors.accentMuted : theme.colors.surface
                  }
                ]}
              >
                <Avatar uri={item.avatar} name={item.fullName} size={42} showOnlineDot isOnline={item.isOnline} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{item.fullName}</Text>
                  <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                    {item.role.toUpperCase()} - {item.department}
                  </Text>
                </View>
                {selected ? <Feather name="check-circle" size={18} color={theme.colors.accent} /> : null}
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        <AppButton
          label={
            mode === "direct" ? "Start chat" : `Create group (${selectedIds.length})`
          }
          onPress={handleCreate}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  closeBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  content: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  modeTabs: {
    flexDirection: "row",
    gap: 8
  },
  tabBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  titleInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12
  },
  titleInputWeb: {
    outlineStyle: "solid",
    outlineWidth: 0,
    outlineColor: "transparent"
  },
  row: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 68,
    paddingHorizontal: 12
  },
  rowCopy: {
    flex: 1,
    gap: 4,
    marginLeft: 10
  },
  name: {
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    fontSize: 12
  }
});
