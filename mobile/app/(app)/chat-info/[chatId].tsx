import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  Avatar,
  EmptyState,
  SearchBar,
  SectionHeader,
  UserCard
} from "@/components/common";
import { DetailScreenShell } from "@/components/layout";
import { GlassView, IconButton } from "@/components/ui";
import { PRESENCE_LABELS } from "@/constants/chat";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore } from "@/store/chatStore";
import type { ChatSummary, User } from "@/types";
import { useShallow } from "zustand/react/shallow";

type FeatherName = React.ComponentProps<typeof Feather>["name"];
type QuickActionId = "message" | "members" | "files";

const adminRoles = new Set(["ceo", "cto", "manager", "hr"]);

const kindTitleMap: Record<ChatSummary["kind"], string> = {
  direct: "Profile",
  group: "Group Info"
};

const kindLabelMap: Record<ChatSummary["kind"], string> = {
  direct: "Direct",
  group: "Group"
};

const formatCalendarDate = (iso?: string): string => {
  if (!iso) {
    return "Not available";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

interface QuickActionProps {
  icon: FeatherName;
  label: string;
  active?: boolean;
  onPress: () => void;
}

function QuickAction({ icon, label, active = false, onPress }: QuickActionProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.quickAction,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: active
            ? theme.colors.accentMuted
            : hovered
            ? theme.colors.glassHover
            : theme.colors.glassSoft,
          opacity: pressed ? 0.88 : 1
        }
      ]}
    >
      <Feather name={icon} size={18} color={active ? theme.colors.accent : theme.colors.textSecondary} />
      <Text style={[styles.quickActionLabel, { color: active ? theme.colors.accent : theme.colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

interface InfoRowProps {
  icon: FeatherName;
  label: string;
  value: string;
  onPress?: () => void;
}

function InfoRow({ icon, label, value, onPress }: InfoRowProps): JSX.Element {
  const { theme } = useAppTheme();
  const row = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: theme.colors.accentMuted }]}>
        <Feather name={icon} size={15} color={theme.colors.accent} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: theme.colors.textMuted }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]}>{value}</Text>
      </View>
      {onPress ? <Feather name="chevron-right" size={17} color={theme.colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.infoRow,
          { borderRadius: theme.radius.lg, backgroundColor: theme.colors.glassSoft }
        ]}
      >
        {row}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.infoRow,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: hovered ? theme.colors.glassHover : theme.colors.glassSoft,
          opacity: pressed ? 0.9 : 1
        }
      ]}
    >
      {row}
    </Pressable>
  );
}

export default function ChatInfoScreen(): JSX.Element {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const { isDesktop } = useResponsive();
  const currentUser = useCurrentUser();

  const {
    chats,
    users,
    sharedFiles,
    messagesByChat
  } = useChatStore(
    useShallow((state) => ({
      chats: state.chats,
      users: state.users,
      sharedFiles: state.sharedFiles,
      messagesByChat: state.messagesByChat
    }))
  );

  const [memberQuery, setMemberQuery] = useState("");

  const chat = useMemo(() => chats.find((item) => item.id === chatId), [chats, chatId]);
  const messages = useMemo(() => (chat ? messagesByChat[chat.id] ?? [] : []), [messagesByChat, chat]);
  const files = useMemo(
    () =>
      (chat ? sharedFiles.filter((file) => file.chatId === chat.id) : []).sort((a, b) =>
        b.uploadedAt.localeCompare(a.uploadedAt)
      ),
    [chat, sharedFiles]
  );
  const mediaCount = useMemo(
    () =>
      files.filter((file) => file.type === "image" || file.type === "video_note").length +
      messages.filter((message) => message.type === "image" || message.type === "video_note").length,
    [files, messages]
  );
  const linksCount = useMemo(
    () =>
      messages.reduce((count, message) => {
        const matches = message.body.match(/https?:\/\/\S+/gi);
        return count + (matches?.length ?? 0);
      }, 0),
    [messages]
  );
  const members = useMemo(
    () => (chat ? users.filter((user) => chat.memberIds.includes(user.id)) : []),
    [chat, users]
  );
  const directPeer = useMemo(
    () => (chat?.kind === "direct" ? members.find((member) => member.id !== currentUser.id) : undefined),
    [chat?.kind, currentUser.id, members]
  );
  const admins = useMemo(
    () => members.filter((member) => adminRoles.has(member.role)),
    [members]
  );
  const orderedMembers = useMemo(() => {
    const adminIds = new Set(admins.map((member) => member.id));
    return [...admins, ...members.filter((member) => !adminIds.has(member.id))];
  }, [admins, members]);
  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) {
      return orderedMembers;
    }
    return orderedMembers.filter((member) => {
      return (
        member.fullName.toLowerCase().includes(query) ||
        member.department.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      );
    });
  }, [memberQuery, orderedMembers]);

  if (!chat) {
    const handleClose = () => {
      if (Platform.OS === "web") {
        router.replace("/(app)/(tabs)/chats");
        return;
      }
      router.back();
    };
    return (
      <DetailScreenShell>
        <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
          <SectionHeader
            title="Chat info"
            subtitle="Details"
            rightSlot={
              <IconButton icon="x" accessibilityLabel="Close details" tone="plain" onPress={handleClose} />
            }
          />
          <EmptyState
            title="Conversation not found"
            description="Open a valid chat from your conversation list."
            icon="alert-circle"
          />
        </ScrollView>
      </DetailScreenShell>
    );
  }

  const owner = admins[0] ?? members[0];
  const manager = directPeer?.managerId ? users.find((user) => user.id === directPeer.managerId) : undefined;
  const peerMeta = directPeer
    ? {
        handle: directPeer.handle,
        phone: directPeer.phone,
        officeLocation: directPeer.officeLocation,
        joinedAt: directPeer.createdAt
      }
    : undefined;

  const heroTitle = chat.kind === "direct" ? directPeer?.fullName ?? chat.title : chat.title;
  const heroAvatar = chat.kind === "direct" ? directPeer?.avatar : chat.avatar;
  const heroSubtitle =
    chat.kind === "direct"
      ? `${ROLE_LABELS[directPeer?.role ?? currentUser.role]} - ${directPeer?.department ?? currentUser.department}`
      : chat.subtitle ?? `${chat.memberIds.length} members`;
  const heroDescription =
    chat.kind === "direct"
      ? directPeer?.about ?? "Direct message with a teammate."
      : "Group chat for team collaboration.";
  const handleClose = () => {
    if (Platform.OS === "web") {
      router.replace("/(app)/(tabs)/chats");
      return;
    }
    router.back();
  };
  const openMediaScreen = () => {
    router.push({
      pathname: "/(app)/resources/[chatId]" as never,
      params: { chatId: chat.id } as never
    });
  };

  const quickActionMap: Record<QuickActionId, { icon: FeatherName; label: string; onPress: () => void; active?: boolean }> = {
    message: {
      icon: "message-square",
      label: "Message",
      onPress: () => router.replace({ pathname: "/(app)/chat/[chatId]", params: { chatId: chat.id } })
    },
    members: {
      icon: "users",
      label: "Members",
      onPress: () => toast.info("Members section", "Scroll down to view and filter members.")
    },
    files: {
      icon: "paperclip",
      label: "Files",
      onPress: openMediaScreen
    }
  };

  const quickActionOrder: QuickActionId[] =
    chat.kind === "direct" ? ["message", "files"] : ["message", "members", "files"];

  return (
    <DetailScreenShell>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <SectionHeader
          title={kindTitleMap[chat.kind]}
          subtitle={heroTitle}
          rightSlot={
            <IconButton icon="x" accessibilityLabel="Close details" tone="plain" onPress={handleClose} />
          }
        />

        <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.heroCard}>
          <Avatar
            uri={heroAvatar}
            name={heroTitle}
            size={92}
            shape={chat.kind === "group" ? "squircle" : "circle"}
            showOnlineDot={chat.kind === "direct"}
            isOnline={directPeer?.isOnline}
          />
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>{heroTitle}</Text>
            <View style={styles.heroBadges}>
              <View style={[styles.badge, { backgroundColor: theme.colors.accentMuted }]}>
                <Text style={[styles.badgeLabel, { color: theme.colors.accent }]}>{kindLabelMap[chat.kind]}</Text>
              </View>
              {chat.kind === "direct" ? (
                <View style={[styles.badge, { backgroundColor: theme.colors.glassSoft }]}>
                  <Text style={[styles.badgeLabel, { color: theme.colors.textSecondary }]}>
                    {PRESENCE_LABELS[directPeer?.presence ?? currentUser.presence]}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>{heroSubtitle}</Text>
            {chat.kind === "direct" && peerMeta?.handle ? (
              <Text style={[styles.heroHandle, { color: theme.colors.accent }]}>{peerMeta.handle}</Text>
            ) : null}
            <Text style={[styles.heroDescription, { color: theme.colors.textMuted }]}>{heroDescription}</Text>
          </View>
        </GlassView>

        <View style={styles.quickActionsRow}>
          {quickActionOrder.map((actionId) => {
            const action = quickActionMap[actionId];
            return (
              <QuickAction key={actionId} icon={action.icon} label={action.label} onPress={action.onPress} active={action.active} />
            );
          })}
        </View>

        <View style={styles.metricsRow}>
          {[
            { label: "Members", value: chat.memberIds.length },
            { label: "Media", value: mediaCount },
            { label: "Resources", value: files.length + linksCount }
          ].map((metric) => (
            <GlassView
              key={metric.label}
              tone="soft"
              radius={theme.radius.lg}
              bordered={false}
              style={styles.metricCard}
            >
              <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>{metric.value}</Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>{metric.label}</Text>
            </GlassView>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Details</Text>
          {chat.kind === "direct" ? (
            <>
              <InfoRow icon="mail" label="Email" value={directPeer?.email ?? "Not available"} />
              <InfoRow icon="phone" label="Phone" value={peerMeta?.phone ?? "Not available"} />
              <InfoRow icon="briefcase" label="Department" value={directPeer?.department ?? currentUser.department} />
              <InfoRow icon="user-check" label="Reports to" value={manager ? `${manager.fullName} (${ROLE_LABELS[manager.role]})` : "Not assigned"} />
              <InfoRow icon="map-pin" label="Work location" value={peerMeta?.officeLocation ?? "Not available"} />
              <InfoRow icon="calendar" label="Joined" value={formatCalendarDate(peerMeta?.joinedAt)} />
              <InfoRow icon="clock" label="Timezone" value={directPeer?.timezone ?? "Not available"} />
              <InfoRow icon="info" label="About" value={directPeer?.about ?? "Not available"} />
            </>
          ) : (
            <>
              <InfoRow icon="users" label="Members" value={`${chat.memberIds.length} members`} />
              <InfoRow icon="shield" label="Owner" value={owner ? `${owner.fullName} (${ROLE_LABELS[owner.role]})` : "Not available"} />
              <InfoRow icon="calendar" label="Created" value={formatCalendarDate(chat.createdAt)} />
              <InfoRow icon="file-text" label="Description" value={heroDescription} />
            </>
          )}
        </View>

        {chat.kind !== "direct" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Members</Text>
              <Text style={[styles.sectionMeta, { color: theme.colors.textMuted }]}>{members.length} total</Text>
            </View>
            <SearchBar value={memberQuery} onChangeText={setMemberQuery} onClear={() => setMemberQuery("")} placeholder="Search members" />
            <View style={styles.membersList}>
              {filteredMembers.map((member: User) => (
                <UserCard
                  key={member.id}
                  user={member}
                  trailingLabel={adminRoles.has(member.role) ? "Admin" : undefined}
                  onPress={() => toast.info(member.fullName, `${member.title} - ${member.department}`)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Shared Content</Text>
            <Pressable onPress={openMediaScreen}>
              <Text style={[styles.sectionLink, { color: theme.colors.accent }]}>Open all</Text>
            </Pressable>
          </View>
          <InfoRow
            icon="image"
            label="Shared media"
            value={`${mediaCount} items`}
            onPress={openMediaScreen}
          />
          <InfoRow
            icon="paperclip"
            label="Shared files"
            value={`${files.length} files`}
            onPress={openMediaScreen}
          />
          <InfoRow
            icon="link"
            label="Shared links"
            value={`${linksCount} links`}
            onPress={openMediaScreen}
          />
        </View>
      </ScrollView>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 14,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  heroCard: {
    flexDirection: "row",
    gap: 16,
    padding: 18
  },
  heroContent: {
    flex: 1,
    gap: 6
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "800"
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: "600"
  },
  heroHandle: {
    fontSize: 13,
    fontWeight: "700"
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 18
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickAction: {
    alignItems: "center",
    minHeight: 72,
    minWidth: 72,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1
  },
  quickActionLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700"
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10
  },
  metricCard: {
    flex: 1,
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800"
  },
  metricLabel: {
    fontSize: 12
  },
  section: {
    gap: 10
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700"
  },
  sectionMeta: {
    fontSize: 12
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: "700"
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 14
  },
  rowIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 10
  },
  rowCopy: {
    flex: 1,
    gap: 2
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600"
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "600"
  },
  membersList: {
    gap: 10
  }
});
