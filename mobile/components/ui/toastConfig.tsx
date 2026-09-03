import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import type { ToastConfig, ToastConfigParams } from "react-native-toast-message";

import { AppText } from "@/components/ui/AppText";
import { GlassView } from "@/components/ui/GlassView";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { IconName } from "@/components/ui/IconButton";

type ToastTone = "success" | "error" | "info";

interface ToastCardProps {
  tone: ToastTone;
  title?: string;
  message?: string;
}

const TONE_ICON: Record<ToastTone, IconName> = {
  success: "check-circle",
  error: "alert-triangle",
  info: "info"
};

function ToastCard({ tone, title, message }: ToastCardProps): JSX.Element {
  const { theme } = useAppTheme();
  const accent =
    tone === "success" ? theme.colors.success : tone === "error" ? theme.colors.danger : theme.colors.accent;

  return (
    <GlassView material="thick" radius={theme.radius.xl} highlight elevation="panel" style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
        <Feather name={TONE_ICON[tone]} size={16} color={accent} />
      </View>
      <View style={styles.copy}>
        {title ? (
          <AppText variant="subheadEmphasized" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {message ? (
          <AppText variant="footnote" tone="secondary" numberOfLines={2}>
            {message}
          </AppText>
        ) : null}
      </View>
    </GlassView>
  );
}

const renderToast = (tone: ToastTone) =>
  function ToastRenderer({ text1, text2 }: ToastConfigParams<unknown>): JSX.Element {
    return <ToastCard tone={tone} title={text1} message={text2} />;
  };

/** Glass-styled replacements for the library's default light toast cards. */
export const toastConfig: ToastConfig = {
  success: renderToast("success"),
  error: renderToast("error"),
  info: renderToast("info")
};

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 12,
    maxWidth: 460,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: "92%"
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  copy: {
    flex: 1,
    gap: 2
  },
  copySpacing: {
    gap: 2
  }
});
