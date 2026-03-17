import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, ScreenContainer } from "@/components/common";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";

const highlights = [
  "Direct and group conversations for teams",
  "Presence, read receipts, and typing indicators",
  "Shared files, searchable chat lists, and role-aware collaboration"
];

export default function OnboardingScreen(): JSX.Element {
  const { theme } = useAppTheme();
  const router = useRouter();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <View
          style={[
            styles.logoWrap,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Qora Qarg'a</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Premium internal communication for teams, managers, and leadership.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {highlights.map((item) => (
            <View key={item} style={styles.itemRow}>
              <View style={[styles.itemDot, { backgroundColor: theme.colors.accent }]} />
              <Text style={[styles.itemText, { color: theme.colors.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <AppButton
            label="Get Started"
            onPress={() => {
              completeOnboarding();
              router.replace("/(auth)/login");
            }}
          />
          <Pressable onPress={() => router.replace("/(auth)/register")} hitSlop={8}>
            <Text style={[styles.link, { color: theme.colors.accent }]}>Create account</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 30
  },
  logoWrap: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    marginBottom: 24,
    width: 72
  },
  logoImage: {
    height: 44,
    width: 44
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 540
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginTop: 24,
    padding: 18
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  itemDot: {
    borderRadius: 999,
    height: 7,
    width: 7
  },
  itemText: {
    flex: 1,
    fontSize: 14
  },
  actions: {
    gap: 14,
    marginTop: 24
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  }
});
