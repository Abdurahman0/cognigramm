import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, AppInput, ScreenContainer } from "@/components/common";
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

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Sign In</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Access your internal messaging workspace.
        </Text>

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
                error={errors.password?.message}
              />
            )}
          />
          <AppButton label="Continue" onPress={submit} loading={status === "loading"} />
        </View>

        <View style={styles.links}>
          <Pressable onPress={() => router.push("/(auth)/register")}>
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
    paddingVertical: 28
  },
  title: {
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8
  },
  form: {
    gap: 14,
    marginTop: 24
  },
  links: {
    gap: 10,
    marginTop: 18
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  }
});
