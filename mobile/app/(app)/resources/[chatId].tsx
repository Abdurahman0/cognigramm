import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View
} from "react-native";

import { EmptyState, SectionHeader } from "@/components/common";
import { DetailScreenShell } from "@/components/layout";
import { AppText, Chip, IconButton } from "@/components/ui";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useWebEscape } from "@/hooks/useWebEscape";
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

  useWebEscape(() => router.back());

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
      <DetailScreenShell>
        <View style={styles.page}>
          <SectionHeader
            title="Shared content"
            subtitle="Conversation"
            rightSlot={
              <IconButton icon="x" accessibilityLabel="Close" tone="plain" onPress={() => router.back()} />
            }
          />
          <EmptyState title="Conversation not found" description="Select a valid chat." icon="alert-circle" />
        </View>
      </DetailScreenShell>
    );
  }

  return (
    <DetailScreenShell>
      <View style={styles.header}>
        <SectionHeader
          title="Shared content"
          subtitle={chat.title}
          rightSlot={
            <IconButton icon="x" accessibilityLabel="Close" tone="plain" onPress={() => router.back()} />
          }
        />
      </View>

      <View style={styles.content}>
        <View style={styles.filters}>
          {filterOptions.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              active={filter === option.key}
              onPress={() => setFilter(option.key)}
            />
          ))}
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
                accessibilityRole="button"
                onPress={() => openResource(item)}
                style={({ pressed, hovered }) => [
                  styles.row,
                  {
                    borderRadius: theme.radius.lg,
                    backgroundColor: pressed
                      ? theme.colors.fillSecondary
                      : hovered
                      ? theme.colors.fillTertiary
                      : theme.colors.materialUltraThin
                  }
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.accent }]}>
                  <Feather name={icon} size={16} color={theme.colors.onAccent} />
                </View>
                <View style={styles.rowCopy}>
                  <AppText variant="body" numberOfLines={1}>
                    {item.title}
                  </AppText>
                  <AppText variant="footnote" tone="secondary" numberOfLines={1}>
                    {item.subtitle} · {sender?.fullName ?? "Unknown"} · {formatMessageDate(item.createdAt)}
                  </AppText>
                </View>
                <Feather name="external-link" size={16} color={theme.colors.textFaint} />
              </Pressable>
            );
          }}
        />
      </View>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 14,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14
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
  listContent: {
    flexGrow: 1,
    paddingBottom: 20
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 74,
    paddingHorizontal: 14
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  rowCopy: {
    flex: 1,
    gap: 1,
    marginLeft: 10
  },
  rowCopyOnly: {
    flex: 1
  }
});

