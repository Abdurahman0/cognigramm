import { Feather } from "@expo/vector-icons";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { GlassView } from "@/components/ui/GlassView";
import type { IconName } from "@/components/ui/IconButton";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ListSectionProps {
  /** Uppercase group header, as used above grouped table views. */
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Inset grouped list: one glass card, hairline separators between rows. */
export function ListSection({ header, footer, children, style }: ListSectionProps): JSX.Element {
  const { theme } = useAppTheme();
  const rows = Children.toArray(children).filter((child) => isValidElement(child));

  return (
    <View style={[styles.section, style]}>
      {header ? (
        <AppText variant="footnote" tone="secondary" style={styles.header}>
          {header.toUpperCase()}
        </AppText>
      ) : null}
      <GlassView
        material="ultraThin"
        radius={theme.radius.xl}
        bordered={false}
        highlight
        style={styles.card}
      >
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View style={[styles.separator, { backgroundColor: theme.colors.separator }]} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </GlassView>
      {footer ? (
        <AppText variant="caption1" tone="tertiary" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  /** Tinted icon chip colour, like Settings' app glyphs. */
  iconColor?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
}

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  leading,
  trailing,
  onPress,
  destructive = false,
  showChevron
}: ListRowProps): JSX.Element {
  const { theme } = useAppTheme();
  const chevron = showChevron ?? Boolean(onPress);
  const tint = iconColor ?? theme.colors.accent;

  const body = (
    <>
      {leading ??
        (icon ? (
          <View style={[styles.iconChip, { backgroundColor: tint }]}>
            <Feather name={icon} size={15} color={theme.colors.onAccent} />
          </View>
        ) : null)}
      <View style={styles.copy}>
        <AppText
          variant="body"
          numberOfLines={1}
          tone={destructive ? "danger" : "primary"}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="body" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {trailing}
      {chevron ? <Feather name="chevron-right" size={17} color={theme.colors.textFaint} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? theme.colors.fillSecondary
            : hovered
            ? theme.colors.fillTertiary
            : "transparent"
        }
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 7
  },
  header: {
    paddingHorizontal: 18
  },
  footer: {
    paddingHorizontal: 18
  },
  card: {
    overflow: "hidden"
  },
  separator: {
    height: StyleSheet.hairlineWidth * 2,
    marginLeft: 16
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  iconChip: {
    alignItems: "center",
    borderRadius: 8,
    height: 29,
    justifyContent: "center",
    width: 29
  },
  copy: {
    flex: 1,
    gap: 1
  },
  value: {
    flexShrink: 1,
    textAlign: "right"
  }
});
