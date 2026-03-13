import { StyleSheet, Text, View } from "react-native";

import { PRIORITY_LABELS } from "@/constants/chat";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { MessagePriority } from "@/types";

interface PriorityBadgeProps {
  priority: MessagePriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps): JSX.Element {
  const { theme } = useAppTheme();
  const tint =
    priority === "urgent" ? theme.colors.danger : priority === "important" ? theme.colors.warning : theme.colors.textMuted;
  const background =
    priority === "urgent"
      ? `${theme.colors.danger}22`
      : priority === "important"
      ? `${theme.colors.warning}22`
      : theme.colors.surfaceMuted;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: tint }]}>{PRIORITY_LABELS[priority]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  }
});
