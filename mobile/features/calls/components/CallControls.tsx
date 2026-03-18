import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import type { CallStatus, CallType } from "@/features/calls/types";

interface CallControlsProps {
  callId: string;
  status: CallStatus;
  callType: CallType;
  isIncoming: boolean;
  isMuted: boolean;
  isCameraEnabled: boolean;
  speakerEnabled: boolean;
  canSwitchCamera: boolean;
  controlsDisabled?: boolean;
  onAccept: (callId: string) => void;
  onDecline: (callId: string) => void;
  onEnd: (callId: string) => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onToggleSpeaker: () => void;
}

interface ControlButtonProps {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  onPress: () => void;
}

function ControlButton({
  label,
  icon,
  disabled = false,
  danger = false,
  active = false,
  onPress
}: ControlButtonProps): JSX.Element {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.controlButton,
        {
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          borderColor: danger
            ? theme.colors.danger
            : active
            ? theme.colors.accent
            : theme.colors.border,
          backgroundColor: danger
            ? theme.colors.danger + "1E"
            : active
            ? theme.colors.accentMuted
            : theme.colors.surface
        }
      ]}
    >
      <Feather
        name={icon}
        size={15}
        color={danger ? theme.colors.danger : active ? theme.colors.accent : theme.colors.textSecondary}
      />
      <Text
        style={[
          styles.controlLabel,
          {
            color: danger ? theme.colors.danger : active ? theme.colors.accent : theme.colors.textSecondary
          }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CallControls({
  callId,
  status,
  callType,
  isIncoming,
  isMuted,
  isCameraEnabled,
  speakerEnabled,
  canSwitchCamera,
  controlsDisabled = false,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleSpeaker
}: CallControlsProps): JSX.Element {
  const isIncomingRinging = isIncoming && status === "ringing";
  const canEnd = status === "calling" || status === "ringing" || status === "connecting" || status === "connected";
  const inCallControlsVisible = status === "connecting" || status === "connected";

  return (
    <View style={styles.root}>
      {isIncomingRinging ? (
        <View style={styles.row}>
          <ControlButton
            label="Accept"
            icon="phone-call"
            onPress={() => onAccept(callId)}
            disabled={controlsDisabled}
            active
          />
          <ControlButton
            label="Decline"
            icon="phone-off"
            onPress={() => onDecline(callId)}
            disabled={controlsDisabled}
            danger
          />
        </View>
      ) : null}

      {inCallControlsVisible ? (
        <View style={styles.row}>
          <ControlButton
            label={isMuted ? "Unmute" : "Mute"}
            icon={isMuted ? "mic-off" : "mic"}
            onPress={onToggleMute}
            disabled={controlsDisabled}
            active={isMuted}
          />
          <ControlButton
            label={speakerEnabled ? "Speaker" : "Earpiece"}
            icon={speakerEnabled ? "volume-2" : "volume-x"}
            onPress={onToggleSpeaker}
            disabled={controlsDisabled}
            active={speakerEnabled}
          />
          {callType === "video" ? (
            <ControlButton
              label={isCameraEnabled ? "Camera On" : "Camera Off"}
              icon={isCameraEnabled ? "video" : "video-off"}
              onPress={onToggleCamera}
              disabled={controlsDisabled}
              active={!isCameraEnabled}
            />
          ) : null}
          {callType === "video" ? (
            <ControlButton
              label="Switch Cam"
              icon="refresh-cw"
              onPress={onSwitchCamera}
              disabled={controlsDisabled || !canSwitchCamera}
            />
          ) : null}
        </View>
      ) : null}

      {canEnd ? (
        <View style={styles.row}>
          <ControlButton
            label="End Call"
            icon="phone-off"
            onPress={() => onEnd(callId)}
            disabled={controlsDisabled}
            danger
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  controlButton: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    minWidth: 110,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: "700"
  }
});
