import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";

import { AppButton, AppInput, ScreenContainer } from "@/components/common";
import { ForgotFormValues, forgotSchema } from "@/features/auth/schemas";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";

export default function ForgotPasswordScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const status = useAuthStore((state) => state.status);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" }
  });

  const submit = handleSubmit(async (values) => {
    try {
      await requestOtp(values.email);
      toast.success("Verification sent");
      router.push("/(auth)/otp");
    } catch (error) {
      toast.error("Unable to send code", error instanceof Error ? error.message : "Unexpected error");
    }
  });

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Enter your company email and we&apos;ll send a verification code.
        </Text>

        <View style={styles.form}>
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
                error={errors.email?.message}
              />
            )}
          />
          <AppButton label="Send code" onPress={submit} loading={status === "loading"} />
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
  title: {
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  },
  form: {
    gap: 14,
    marginTop: 24
  }
});
