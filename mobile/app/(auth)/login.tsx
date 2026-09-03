import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import {
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputKeyPressEventData,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, AppInput } from "@/components/common";
import { AppText, GlassView } from "@/components/ui";
import { LoginFormValues, loginSchema } from "@/features/auth/schemas";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const submit = handleSubmit(async (values) => {
    try {
      await login(values);
      toast.success("Signed in", "Welcome back.");
      router.replace("/(app)/(tabs)/chats");
    } catch (error) {
      toast.error("Sign-in failed", error instanceof Error ? error.message : "Unexpected error");
    }
  });

  const handleWebEnterSubmit = (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (Platform.OS !== "web" || event.nativeEvent.key !== "Enter") {
      return;
    }
    (event as unknown as { preventDefault?: () => void }).preventDefault?.();
    submit();
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GlassView material="regular" radius={theme.radius.sheet} highlight elevation="floating" style={styles.card}>
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: theme.colors.accentMuted }]}>
              <AppText variant="subheadEmphasized" tone="accent">
                QQ
              </AppText>
            </View>
            <AppText variant="footnote" tone="secondary">
              Qora Qarg&apos;a
            </AppText>
          </View>

          <AppText variant="largeTitle">Sign in</AppText>
          <AppText variant="subhead" tone="secondary">
            Access your internal messaging workspace.
          </AppText>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <AppInput
                  label="Work email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={submit}
                  onKeyPress={handleWebEnterSubmit}
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <AppInput
                  label="Password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={submit}
                  onKeyPress={handleWebEnterSubmit}
                  error={errors.password?.message}
                />
              )}
            />
            <AppButton label="Continue" onPress={submit} loading={status === "loading"} />
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/(auth)/register")}
            style={styles.linkWrap}
          >
            <AppText variant="bodyEmphasized" tone="accent" style={styles.link}>
              Create account
            </AppText>
          </Pressable>
        </GlassView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "transparent",
    flex: 1
  },
  scroll: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    padding: 20
  },
  card: {
    gap: 6,
    maxWidth: 420,
    padding: 26,
    width: "100%"
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  brandMark: {
    alignItems: "center",
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40
  },


  form: {
    gap: 14,
    marginTop: 22
  },
  linkWrap: {
    marginTop: 18
  },
  link: {
    textAlign: "center"
  }
});
