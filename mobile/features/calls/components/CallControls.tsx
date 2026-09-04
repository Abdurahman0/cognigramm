import { StyleSheet, Text, View } from "react-native";

import { IconButton, VolumeSlider, type IconName } from "@/components/ui";
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
  outputVolume: number;
  canSetVolume: boolean;
  isOnHold: boolean;
  /** Local tracks are live; mute and hold have nothing to act on before this. */
  localMediaReady: boolean;
  canSwitchCamera: boolean;
  controlsDisabled?: boolean;
  onAccept: (callId: string) => void;
  onDecline: (callId: string) => void;
  onEnd: (callId: string) => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onToggleSpeaker: () => void;
  onToggleHold: () => void;
  onChangeVolume: (next: number) => void;
}

interface ControlProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger" | "success";
  active?: boolean;
}

function Control({ label, icon, onPress, disabled = false, tone = "neutral", active = false }: ControlProps): JSX.Element {
  const { theme } = useAppTheme();

  return (
    <View style={styles.control}>
      <IconButton
        icon={icon}
        accessibilityLabel={label}
        onPress={onPress}
        disabled={disabled}
        tone={tone}
        active={active}
        size="xl"
      />
      <Text numberOfLines={1} style={[styles.controlLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

/** Circular in-call controls, laid out as a single floating row. */
export function CallControls({
  callId,
  status,
  callType,
  isIncoming,
  isMuted,
  isCameraEnabled,
  speakerEnabled,
  outputVolume,
  canSetVolume,
  isOnHold,
  localMediaReady,
  canSwitchCamera,
  controlsDisabled = false,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleSpeaker,
  onToggleHold,
  onChangeVolume
}: CallControlsProps): JSX.Element {
  const isIncomingRinging = isIncoming && status === "ringing";
  const canEnd = status === "calling" || status === "ringing" || status === "connecting" || status === "connected";
  // The controls come up as soon as the call is yours to run, which includes while it is
  // still dialling — putting an outgoing call on speaker before it is answered is normal.
  // An inbound ring is the exception: that screen is Accept and Decline only.
  const inCallControlsVisible =
    !isIncomingRinging &&
    (status === "calling" || status === "ringing" || status === "connecting" || status === "connected");
  // Mute and hold act on the local tracks, so they stay inert until those exist rather
  // than throwing "no audio track available" at whoever taps first.
  const hasLocalMedia = localMediaReady;

  return (
    <View style={styles.root}>
      {/* Level first: it is the control people reach for mid-sentence, and it needs a
          full-width track to be draggable rather than fiddly. */}
      {inCallControlsVisible ? (
        <VolumeSlider
          value={outputVolume}
          onChange={onChangeVolume}
          disabled={controlsDisabled || !canSetVolume}
          disabledReason="Use device keys"
          accessibilityLabel="Call volume"
        />
      ) : null}

      <View style={styles.controlRow}>
        {isIncomingRinging ? (
          <Control
            label="Accept"
            icon="phone-call"
            tone="success"
            disabled={controlsDisabled}
            onPress={() => onAccept(callId)}
          />
        ) : null}

        {inCallControlsVisible ? (
          <>
            {callType === "video" ? (
              <Control
                label={isCameraEnabled ? "Camera" : "Camera off"}
                icon={isCameraEnabled ? "video" : "video-off"}
                active={!isCameraEnabled}
                disabled={controlsDisabled || !hasLocalMedia}
                onPress={onToggleCamera}
              />
            ) : null}
            <Control
              label={isMuted ? "Unmute" : "Mute"}
              icon={isMuted ? "mic-off" : "mic"}
              active={isMuted}
              disabled={controlsDisabled || !hasLocalMedia}
              onPress={onToggleMute}
            />
            {callType === "video" ? (
              <Control
                label="Flip"
                icon="refresh-cw"
                disabled={controlsDisabled || !hasLocalMedia || !canSwitchCamera}
                onPress={onSwitchCamera}
              />
            ) : null}
            <Control
              label={speakerEnabled ? "Speaker" : "Earpiece"}
              icon={speakerEnabled ? "volume-2" : "smartphone"}
              active={speakerEnabled}
              disabled={controlsDisabled}
              onPress={onToggleSpeaker}
            />
            {/* Hold cuts both directions but leaves the session up, so the call resumes
                without renegotiating. */}
            <Control
              label={isOnHold ? "Resume" : "Hold"}
              icon={isOnHold ? "play" : "pause"}
              active={isOnHold}
              disabled={controlsDisabled || !hasLocalMedia}
              onPress={onToggleHold}
            />
          </>
        ) : null}
      </View>

      {/* Hanging up sits on its own line so it is never a neighbour of mute. */}
      <View style={styles.endRow}>
        {isIncomingRinging ? (
          <Control
            label="Decline"
            icon="phone-off"
            tone="danger"
            disabled={controlsDisabled}
            onPress={() => onDecline(callId)}
          />
        ) : canEnd ? (
          <Control
            label="End"
            icon="phone-off"
            tone="danger"
            disabled={controlsDisabled}
            onPress={() => onEnd(callId)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14
  },
  controlRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "center"
  },
  endRow: {
    alignItems: "center"
  },
  control: {
    alignItems: "center",
    gap: 6,
    minWidth: 62
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: "600"
  }
});
