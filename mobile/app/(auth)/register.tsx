import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, AppInput, ScreenContainer } from "@/components/common";
import { RegisterFormValues, registerSchema } from "@/features/auth/schemas";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";

export default function RegisterScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const register = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      department: "Engineering",
      password: "",
      confirmPassword: ""
    }
  });

  const submit = handleSubmit(async (values) => {
    try {
      await register({
        fullName: values.fullName,
        email: values.email,
        department: values.department,
        password: values.password
      });
      toast.success("Account created", "Welcome to your workspace.");
      router.replace("/(app)/(tabs)/chats");
    } catch (error) {
      toast.error("Registration failed", error instanceof Error ? error.message : "Unexpected error");
    }
  });

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Register your company profile for messaging and coordination.
        </Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="fullName"
            render={({ field }) => (
              <AppInput
                placeholder="Full name"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.fullName?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <AppInput
                placeholder="Work email"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="department"
            render={({ field }) => (
              <AppInput
                placeholder="Department"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.department?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <AppInput
                placeholder="Password"
                secureTextEntry
                value={field.value}
                onChangeText={field.onChange}
                error={errors.password?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <AppInput
                placeholder="Confirm password"
                secureTextEntry
                value={field.value}
                onChangeText={field.onChange}
                error={errors.confirmPassword?.message}
              />
            )}
          />
          <AppButton label="Create account" onPress={submit} loading={status === "loading"} />
        </View>

        <Pressable style={styles.signInWrap} onPress={() => router.replace("/(auth)/login")}>
          <Text style={[styles.link, { color: theme.colors.accent }]}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingVertical: 24
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
    gap: 12,
    marginTop: 22
  },
  signInWrap: {
    marginTop: 16
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  }
});
