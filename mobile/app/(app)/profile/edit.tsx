import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, View } from "react-native";
import { z } from "zod";

import { AppButton, AppInput, Avatar, SectionHeader } from "@/components/common";
import { DetailScreenShell } from "@/components/layout";
import { GlassView, IconButton } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppToast } from "@/hooks/useAppToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChatStore } from "@/store/chatStore";

const schema = z.object({
  fullName: z.string().min(3, "Name is required"),
  title: z.string().min(2, "Title is required"),
  about: z.string().min(3, "Add a short profile summary"),
  avatar: z.string().url("Enter a valid image URL")
});

type EditValues = z.infer<typeof schema>;

export default function EditProfileScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const user = useCurrentUser();
  const updateCurrentUserProfile = useChatStore((state) => state.updateCurrentUserProfile);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<EditValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user.fullName,
      title: user.title,
      about: user.about,
      avatar: user.avatar
    }
  });

  const previewAvatar = watch("avatar");
  const previewName = watch("fullName");

  const save = handleSubmit(async (values) => {
    try {
      await updateCurrentUserProfile(values);
      toast.success("Profile updated");
      router.back();
    } catch (error) {
      toast.error("Unable to update profile", error instanceof Error ? error.message : "Unexpected error");
    }
  });

  return (
    <DetailScreenShell maxWidth={640}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader
          title="Edit profile"
          subtitle="Update personal details and avatar"
          rightSlot={<IconButton icon="x" accessibilityLabel="Close" tone="plain" onPress={() => router.back()} />}
        />

        <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.preview}>
          <Avatar
            uri={previewAvatar || user.avatar}
            name={previewName || user.fullName}
            size={88}
            shape="squircle"
            showOnlineDot
            isOnline={user.isOnline}
          />
        </GlassView>

        <View style={styles.form}>
          <Controller
            control={control}
            name="fullName"
            render={({ field }) => (
              <AppInput
                label="Full name"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.fullName?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <AppInput
                label="Job title"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.title?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="about"
            render={({ field }) => (
              <AppInput
                label="About"
                value={field.value}
                onChangeText={field.onChange}
                error={errors.about?.message}
                multiline
                style={styles.multiline}
              />
            )}
          />
          <Controller
            control={control}
            name="avatar"
            render={({ field }) => (
              <AppInput
                label="Avatar URL"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                error={errors.avatar?.message}
              />
            )}
          />

          <AppButton label="Save changes" onPress={save} />
        </View>
      </ScrollView>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  preview: {
    alignItems: "center",
    paddingVertical: 20
  },
  form: {
    gap: 12
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top"
  }
});
