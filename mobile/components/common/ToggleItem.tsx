import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { GlassSwitch } from "@/components/ui/GlassSwitch";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ToggleItemProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Rows inside a ListSection skip their own background. */
  standalone?: boolean;
}

export function ToggleItem({
  title,
  description,
  value,
  onValueChange,
  standalone = false
}: ToggleItemProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.root,
        standalone && {
          backgroundColor: theme.colors.materialUltraThin,
          borderRadius: theme.radius.xl
        }
      ]}
    >
      <View style={styles.copy}>
        <AppText variant="body">{title}</AppText>
        {description ? (
          <AppText variant="footnote" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <GlassSwitch value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  copy: {
    flex: 1,
    gap: 1
  }
});
