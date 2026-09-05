import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/common";
import { IconButton, ListRow, ListSection } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi, type ApiDeviceSession } from "@/services/api";
import { getAuthSessionId } from "@/services/api/session";
import { useAuthStore } from "@/store/authStore";

const SESSIONS_KEY = ["auth", "sessions"] as const;

/** The list has no device-type field, so the name is the only hint available. */
const iconFor = (deviceName: string): "smartphone" | "monitor" => {
  return /iphone|ipad|android|pixel|galaxy|mobile/i.test(deviceName) ? "smartphone" : "monitor";
};

const relative = (value: string | null): string => {
  if (!value) {
    return "never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

/**
 * Signed-in devices.
 *
 * A refresh token lives up to 180 days, so "where am I signed in" stops being
 * a curiosity and becomes the only way to end a session on a phone the user no
 * longer has. Revoking a row kills its tokens at once and closes the socket it
 * holds.
 */
export function DeviceSessions({ onSignedOut }: { onSignedOut: () => void }): JSX.Element {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const hasSession = useAuthStore((state) => Boolean(state.session));

  const { data, isPending, isError } = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => authApi.sessions(),
    enabled: hasSession,
    staleTime: 30_000
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: (_result, sessionId) => {
      if (sessionId === getAuthSessionId()) {
        logout();
        onSignedOut();
        return;
      }
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }).catch(() => undefined);
    }
  });

  const logoutAll = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      logout();
      onSignedOut();
    }
  });

  const sessions: ApiDeviceSession[] = Array.isArray(data) ? data : [];

  return (
    <ListSection
      header="Devices"
      footer="Each sign-in creates its own session. Revoking one signs that device out immediately."
    >
      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      ) : isError ? (
        <ListRow title="Could not load your devices" subtitle="Pull down to try again" showChevron={false} />
      ) : sessions.length === 0 ? (
        <ListRow title="No other devices" showChevron={false} />
      ) : (
        sessions.map((session) => {
          const isCurrent = session.is_current || session.id === getAuthSessionId();
          return (
            <ListRow
              key={session.id}
              title={session.device_name || "Unknown device"}
              subtitle={`${isCurrent ? "This device · " : ""}last active ${relative(session.last_used_at)}`}
              icon={iconFor(session.device_name)}
              iconColor={isCurrent ? theme.colors.accent : theme.colors.textMuted}
              showChevron={false}
              trailing={
                revoke.isPending && revoke.variables === session.id ? (
                  <ActivityIndicator color={theme.colors.danger} />
                ) : (
                  <IconButton
                    icon="log-out"
                    accessibilityLabel={isCurrent ? "Sign out this device" : `Revoke ${session.device_name}`}
                    tone="plain"
                    onPress={() => revoke.mutate(session.id)}
                  />
                )
              }
            />
          );
        })
      )}

      <View style={styles.footerRow}>
        <AppButton
          variant="danger"
          label="Sign out everywhere"
          fullWidth={false}
          icon={<Feather name="shield-off" size={16} color={theme.colors.onAccent} />}
          onPress={() => logoutAll.mutate()}
        />
      </View>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20
  },
  footerRow: {
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12
  }
});
