import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, AppInput, ScreenContainer } from "@/components/common";
import { OtpFormValues, otpSchema } from "@/features/auth/schemas";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";

export default function OtpScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const otpEmail = useAuthStore((state) => state.otpEmail);
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const status = useAuthStore((state) => state.status);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" }
  });

  const submit = handleSubmit(async (values) => {
    try {
      await verifyOtp(values.code);
      toast.success("Verification complete");
      router.replace("/(app)/(tabs)/chats");
    } catch (error) {
      toast.error("Verification failed", error instanceof Error ? error.message : "Unexpected error");
    }
  });

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>OTP Verification</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Enter the six-digit code sent to {otpEmail || "your email"}.
        </Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <AppInput
                label="Verification code"
                keyboardType="number-pad"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.code?.message}
                hint="Demo code: 123456"
              />
            )}
          />
          <AppButton label="Verify and continue" onPress={submit} loading={status === "loading"} />
          <Pressable
            onPress={async () => {
              if (!otpEmail) {
                router.replace("/(auth)/forgot-password");
                return;
              }
              await requestOtp(otpEmail);
              toast.info("Code resent", "Use 123456 for demo.");
            }}
          >
            <Text style={[styles.link, { color: theme.colors.accent }]}>Resend code</Text>
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
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  }
});
