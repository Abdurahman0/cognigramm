import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, AppInput, Avatar, ScreenContainer, SectionHeader } from "@/components/common";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
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

  const save = handleSubmit((values) => {
    updateCurrentUserProfile(values);
    toast.success("Profile updated");
    router.back();
  });

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <SectionHeader
          title="Edit Profile"
          subtitle="Update personal details and avatar"
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: "700" }}>Close</Text>
            </Pressable>
          }
        />

        <View style={styles.preview}>
          <Avatar uri={user.avatar} name={user.fullName} size={70} showOnlineDot isOnline={user.isOnline} />
        </View>

        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <AppInput label="Full name" value={field.value} onChangeText={field.onChange} error={errors.fullName?.message} />
          )}
        />
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <AppInput label="Job title" value={field.value} onChangeText={field.onChange} error={errors.title?.message} />
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
              style={{ minHeight: 90, textAlignVertical: "top" }}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12
  },
  closeBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 8
  },
  preview: {
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4
  }
});
