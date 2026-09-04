import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { AppText } from "@/components/ui/AppText";
import { ROLE_LABELS } from "@/constants/roles";
import { RaisedCard } from "@/components/ui/RaisedCard";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { User } from "@/types";

interface UserCardProps {
  user: User;
  onPress?: () => void;
  trailingLabel?: string;
  /** Rows normally sit inside a grouped ListSection, which draws the card. */
  standalone?: boolean;
}

export function UserCard({ user, onPress, trailingLabel, standalone = false }: UserCardProps): JSX.Element {
  const { theme } = useAppTheme();

  const body = (
    <>
      <Avatar uri={user.avatar} name={user.fullName} isOnline={user.isOnline} showOnlineDot size={44} />
      <View style={styles.main}>
        <AppText variant="body" numberOfLines={1}>
          {user.fullName}
        </AppText>
        <AppText variant="footnote" tone="secondary" numberOfLines={1}>
          {ROLE_LABELS[user.role]} · {user.department}
        </AppText>
      </View>
      {trailingLabel ? (
        <AppText variant="footnote" tone={user.isOnline ? "success" : "tertiary"}>
          {trailingLabel}
        </AppText>
      ) : null}
      <Feather name="chevron-right" size={17} color={theme.colors.textFaint} />
    </>
  );

  if (standalone) {
    return (
      <RaisedCard
        accessibilityRole="button"
        accessibilityLabel={user.fullName}
        onPress={onPress}
        radius={theme.radius.lg}
        style={styles.cardOuter}
        contentStyle={styles.root}
      >
        {body}
      </RaisedCard>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed, hovered }) => [
        styles.root,
        {
          backgroundColor: pressed
            ? theme.colors.fillSecondary
            : hovered
            ? theme.colors.fillTertiary
            : "transparent"
        }
      ]}
      onPress={onPress}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    paddingVertical: 4
  },
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  main: {
    flex: 1,
    gap: 1
  }
});
