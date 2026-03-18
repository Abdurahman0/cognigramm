import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { formatMessageDate } from "@/utils/date";
import { useShallow } from "zustand/react/shallow";

type MediaFilter = "all" | "media" | "files" | "links";
type MediaItemKind = "media" | "file" | "link";

interface MediaItem {
  id: string;
  kind: MediaItemKind;
  title: string;
  subtitle: string;
  createdAt: string;
  senderId: string;
  url: string;
}

const filterOptions: { key: MediaFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "media", label: "Media" },
  { key: "files", label: "Files" },
  { key: "links", label: "Links" }
];

const linkPattern = /https?:\/\/[^\s)]+/gi;

export default function MediaScreen(): JSX.Element {
  const router = useRouter();
  const toast = useAppToast();
  const { theme } = useAppTheme();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const [filter, setFilter] = useState<MediaFilter>("all");

  const { chats, users, messages } = useChatStore(
    useShallow((state) => ({
      chats: state.chats,
      users: state.users,
      messages: chatId ? state.messagesByChat[chatId] ?? [] : []
    }))
  );

  const chat = useMemo(() => chats.find((item) => item.id === chatId), [chats, chatId]);

  const items = useMemo<MediaItem[]>(() => {
    const rows: MediaItem[] = [];
    messages.forEach((message) => {
      if (message.isDeleted) {
        return;
      }

      const attachment = message.attachment;
      if (attachment) {
        const lowerMime = attachment.mimeType.toLowerCase();
        const isImage = message.type === "image" || lowerMime.startsWith("image/");
        const isVideoNote = message.type === "video_note" || lowerMime.startsWith("video/");
        const resourceUrl = attachment.publicUrl ?? attachment.uri ?? "";
        rows.push({
          id: `${message.id}_${attachment.id}`,
          kind: isImage || isVideoNote ? "media" : "file",
          title: attachment.name,
          subtitle: attachment.sizeLabel,
          createdAt: message.createdAt,
          senderId: message.senderId,
          url: resourceUrl
        });
      }

      const links = message.body.match(linkPattern) ?? [];
      links.forEach((link, index) => {
        rows.push({
          id: `${message.id}_link_${index}`,
          kind: "link",
          title: link,
          subtitle: "Shared link",
          createdAt: message.createdAt,
          senderId: message.senderId,
          url: link
        });
      });
    });
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [messages]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return items;
    }
    if (filter === "media") {
      return items.filter((item) => item.kind === "media");
    }
    if (filter === "files") {
      return items.filter((item) => item.kind === "file");
    }
    return items.filter((item) => item.kind === "link");
  }, [filter, items]);

  const openResource = async (item: MediaItem) => {
    if (!item.url) {
      toast.info("No public URL", "This resource does not expose a direct URL.");
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(item.url);
      if (!canOpen) {
        toast.error("Cannot open link", item.url);
        return;
      }
      await Linking.openURL(item.url);
    } catch (error) {
      toast.error("Unable to open resource", error instanceof Error ? error.message : "Unexpected error");
    }
  };

  if (!chatId || !chat) {
    return (
      <ScreenContainer scroll padded={false}>
        <View style={styles.page}>
          <SectionHeader
            title="Shared Content"
            subtitle="Conversation"
            rightSlot={
              <Pressable onPress={() => router.back()} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.colors.textPrimary} />
              </Pressable>
            }
          />
          <EmptyState title="Conversation not found" description="Select a valid chat." icon="alert-circle" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Shared Content"
          subtitle={chat.title}
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />
      </View>

      <View style={styles.content}>
        <View style={styles.filters}>
          {filterOptions.map((option) => {
            const active = filter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={[
                  styles.filterBtn,
                  {
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface
                  }
                ]}
              >
                <Text style={[styles.filterLabel, { color: active ? theme.colors.accent : theme.colors.textSecondary }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No shared content"
              description="Files, media, and links from this conversation will appear here."
              icon="paperclip"
            />
          }
          renderItem={({ item }) => {
            const sender = users.find((user) => user.id === item.senderId);
            const icon =
              item.kind === "media" ? "image" : item.kind === "link" ? "link" : Platform.OS === "web" ? "file-text" : "file";
            return (
              <Pressable
                onPress={() => openResource(item)}
                style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <Feather name={icon} size={16} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowMeta, { color: theme.colors.textMuted }]}>
                    {item.subtitle}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowMeta, { color: theme.colors.textMuted }]}>
                    {sender?.fullName ?? "Unknown"} - {formatMessageDate(item.createdAt)}
                  </Text>
                </View>
                <Feather name="external-link" size={14} color={theme.colors.textMuted} />
              </Pressable>
            );
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24
  },
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
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterBtn: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 10,
    justifyContent: "center"
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20
  },
  row: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: 12
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  rowCopy: {
    flex: 1,
    gap: 1,
    marginLeft: 10
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700"
  },
  rowMeta: {
    fontSize: 12
  }
});

