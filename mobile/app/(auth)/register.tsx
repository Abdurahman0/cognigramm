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
          <AppText variant="largeTitle">Create account</AppText>
          <AppText variant="subhead" tone="secondary">
            Register your company profile for messaging and coordination.
          </AppText>

          <View style={styles.form}>
            <Controller
              control={control}
              name="fullName"
              render={({ field }) => (
                <AppInput
                  label="Full name"
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={submit}
                  onKeyPress={handleWebEnterSubmit}
                  error={errors.fullName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <AppInput
                  label="Work email"
                  value={field.value}
                  onChangeText={field.onChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onSubmitEditing={submit}
                  onKeyPress={handleWebEnterSubmit}
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <AppInput
                  label="Department"
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={submit}
                  onKeyPress={handleWebEnterSubmit}
                  error={errors.department?.message}
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
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field }) => (
                <AppInput
                  label="Confirm password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  onSubmitEditing={submit}
                  onKeyPress={handleWebEnterSubmit}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
            <AppButton label="Create account" onPress={submit} loading={status === "loading"} />
          </View>

          <Pressable
            accessibilityRole="link"
            style={styles.linkWrap}
            onPress={() => router.replace("/(auth)/login")}
          >
            <AppText variant="bodyEmphasized" tone="accent" style={styles.link}>
              Already have an account? Sign in
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
    maxWidth: 460,
    padding: 26,
    width: "100%"
  },

  form: {
    gap: 12,
    marginTop: 20
  },
  linkWrap: {
    marginTop: 16
  },
  link: {
    textAlign: "center"
  }
});
