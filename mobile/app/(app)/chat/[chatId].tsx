import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationPanel } from "@/features/chat/ConversationPanel";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function ChatDetailsScreen(): JSX.Element {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { theme } = useAppTheme();

  if (!chatId) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ConversationPanel chatId={chatId} compact />
    </SafeAreaView>
  );
}
