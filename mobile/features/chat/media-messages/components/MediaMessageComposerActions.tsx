import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PreparedMediaDraft } from "@/features/chat/media-messages/types";
import { useAppTheme } from "@/hooks/useAppTheme";

interface MediaMessageComposerActionsProps {
  voiceDraft: PreparedMediaDraft | null;
  videoDraft: PreparedMediaDraft | null;
  voiceRecording: boolean;
  voiceBusy: boolean;
  videoRecording: boolean;
  videoNeedsStopAction: boolean;
  videoBusy: boolean;
  isSending: boolean;
  sendErrorMessage?: string;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onCancelVoiceRecording: () => void;
  onStartVideoRecording: () => void;
  onStopVideoRecording: () => void;
  onCancelVideoRecording: () => void;
  onSendDraft: (draft: PreparedMediaDraft) => void;
  onDiscardDraft: () => void;
}

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const renderWaveform = (waveform: number[] | undefined, color: string): JSX.Element | null => {
  if (!waveform || waveform.length === 0) {
    return null;
  }
  return (
    <View style={styles.waveformRow}>
      {waveform.slice(0, 24).map((point, index) => {
        const normalized = point > 1 ? point / 100 : point;
        return (
          <View
            key={`${index}_${point}`}
            style={[
              styles.waveformBar,
              {
                backgroundColor: color,
                height: Math.max(4, Math.round(normalized * 22)),
              },
            ]}
          />
        );
      })}
    </View>
  );
};

export function MediaMessageComposerActions({
  voiceDraft,
  videoDraft,
  voiceRecording,
  voiceBusy,
  videoRecording,
  videoNeedsStopAction,
  videoBusy,
  isSending,
  sendErrorMessage,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onCancelVoiceRecording,
  onStartVideoRecording,
  onStopVideoRecording,
  onCancelVideoRecording,
  onSendDraft,
  onDiscardDraft,
}: MediaMessageComposerActionsProps): JSX.Element {
  const { theme } = useAppTheme();
  const draft = videoDraft ?? voiceDraft;
  const isAnyRecording = voiceRecording || videoRecording;
  const controlsDisabled = isSending || voiceBusy || videoBusy;
  const draftMetadata = (draft?.metadataJson ?? {}) as Record<string, unknown>;
  const voiceWaveform =
    draft?.type === "voice" && Array.isArray(draftMetadata.waveform)
      ? draftMetadata.waveform.filter((value): value is number => typeof value === "number")
      : undefined;

  return (
    <View style={styles.root}>
      {draft ? (
        <View
          style={[
            styles.previewRow,
            {
              borderColor: theme.colors.glassBorder,
              backgroundColor: theme.colors.glassSoft,
            },
          ]}
        >
          <View style={styles.previewLeft}>
            <View
              style={[
                styles.previewIcon,
                {
                  backgroundColor: theme.colors.glassHover,
                  borderColor: theme.colors.glassBorder,
                },
              ]}
            >
              <Feather
                name={draft.type === "voice" ? "mic" : "video"}
                size={14}
                color={theme.colors.textSecondary}
              />
            </View>
            <View style={styles.previewCopy}>
              <Text style={[styles.previewTitle, { color: theme.colors.textPrimary }]}>
                {draft.type === "voice" ? "Voice message ready" : "Video note ready"}
              </Text>
              <Text style={[styles.previewSubtitle, { color: theme.colors.textMuted }]}>
                {formatDuration(draft.durationMs)}
              </Text>
              {draft.type === "voice" ? renderWaveform(voiceWaveform, theme.colors.accent) : null}
            </View>
          </View>
          <View style={styles.previewActions}>
            <Pressable
              onPress={isSending ? undefined : onDiscardDraft}
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              style={[
                styles.previewActionButton,
                { backgroundColor: theme.colors.glassHover, borderColor: theme.colors.glassBorder },
              ]}
            >
              <Feather name="x" size={16} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={isSending ? undefined : () => onSendDraft(draft)}
              accessibilityRole="button"
              accessibilityLabel={draft.type === "voice" ? "Send voice message" : "Send video note"}
              style={[
                styles.previewActionButton,
                { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
              ]}
            >
              <Feather name="send" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : null}
      {sendErrorMessage ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{sendErrorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  previewRow: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  previewIcon: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  previewSubtitle: {
    fontSize: 12,
  },
  previewActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
  },
  previewActionButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  waveformRow: {
    alignItems: "flex-end",
    columnGap: 2,
    flexDirection: "row",
    height: 24,
    marginTop: 2,
  },
  waveformBar: {
    borderRadius: 999,
    width: 2,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 2,
  },
});
