import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

export default function NotFoundScreen(): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Page not found</Text>
      <Link href="/" style={[styles.link, { color: theme.colors.accent }]}>
        Back to home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 20
  },
  title: {
    fontSize: 22,
    fontWeight: "700"
  },
  link: {
    fontSize: 14,
    fontWeight: "600"
  }
});
