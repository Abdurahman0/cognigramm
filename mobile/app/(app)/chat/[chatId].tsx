import { useLocalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationPanel } from "@/features/chat/ConversationPanel";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function ChatDetailsScreen(): JSX.Element {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { theme } = useAppTheme();
  const webPanelStyle = Platform.OS === "web" ? styles.webPanel : null;

  if (!chatId) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={[styles.panelWrap, webPanelStyle]}>
        <ConversationPanel chatId={chatId} compact />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  panelWrap: {
    flex: 1,
    width: "100%"
  },
  webPanel: {
    alignSelf: "center",
    maxWidth: 1120
  }
});
