import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent
} from "react-native";

import { VideoNoteBubble } from "@/features/chat/media-messages/components/VideoNoteBubble";
import { VoiceMessageBubble } from "@/features/chat/media-messages/components/VoiceMessageBubble";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { ChatMessage } from "@/types";
import { formatMessageDate } from "@/utils/date";

interface MessageBubbleProps {
  message: ChatMessage;
  senderName: string;
  isMine: boolean;
  onLongPress?: () => void;
  onOpenActions?: (event: GestureResponderEvent) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDismissActions?: () => void;
  showActionsTooltip?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const statusIcon: Record<ChatMessage["status"], keyof typeof Feather.glyphMap> = {
  sending: "clock",
  sent: "check",
  delivered: "check-circle",
  seen: "eye"
};
const linkPattern = /((?:https?:\/\/|www\.)[^\s]+)/gi;

interface TextSegment {
  text: string;
  url: string | null;
}

interface CallSummaryPresentation {
  title: string;
  subtitle: string;
  icon: "phone" | "video";
  tone: "neutral" | "danger";
}

const buildTextSegments = (value: string): TextSegment[] => {
  if (!value) {
    return [{ text: "", url: null }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match = linkPattern.exec(value);

  while (match) {
    const startIndex = match.index ?? 0;
    const raw = match[0];
    if (startIndex > lastIndex) {
      segments.push({
        text: value.slice(lastIndex, startIndex),
        url: null
      });
    }
    const trimmedRaw = raw.replace(/[),.!?]+$/g, "");
    const trailing = raw.slice(trimmedRaw.length);
    const normalized =
      trimmedRaw.startsWith("http://") || trimmedRaw.startsWith("https://")
        ? trimmedRaw
        : `https://${trimmedRaw}`;
    segments.push({
      text: trimmedRaw,
      url: normalized
    });
    if (trailing) {
      segments.push({
        text: trailing,
        url: null
      });
    }
    lastIndex = startIndex + raw.length;
    match = linkPattern.exec(value);
  }

  if (lastIndex < value.length) {
    segments.push({
      text: value.slice(lastIndex),
      url: null
    });
  }

  linkPattern.lastIndex = 0;
  return segments.length > 0 ? segments : [{ text: value, url: null }];
};

const getCallSummaryPresentation = (value: string): CallSummaryPresentation | null => {
  const body = value.trim();
  const lower = body.toLowerCase();
  const isVideo = lower.includes("video call");
  const isAudio = lower.includes("audio call");
  if (!isVideo && !isAudio) {
    return null;
  }

  const callLabel = isVideo ? "Video call" : "Audio call";
  const icon: CallSummaryPresentation["icon"] = isVideo ? "video" : "phone";
  const durationMatch = body.match(/\(([^)]+)\)\s*$/);
  const duration = durationMatch?.[1] ?? "";

  if (lower.includes("missed")) {
    return {
      title: `Missed ${callLabel.toLowerCase()}`,
      subtitle: "No answer",
      icon,
      tone: "danger"
    };
  }
  if (lower.includes("declined")) {
    return {
      title: `${callLabel} declined`,
      subtitle: "Call was declined",
      icon,
      tone: "neutral"
    };
  }
  if (lower.includes("failed")) {
    return {
      title: `${callLabel} failed`,
      subtitle: "Connection issue",
      icon,
      tone: "danger"
    };
  }
  if (lower.includes("ended")) {
    return {
      title: `${callLabel} ended`,
      subtitle: duration ? `Duration ${duration}` : "Call finished",
      icon,
      tone: "neutral"
    };
  }

  return {
    title: callLabel,
    subtitle: body,
    icon,
    tone: "neutral"
  };
};

export function MessageBubble({
  message,
  senderName,
  isMine,
  onLongPress,
  onOpenActions,
  onEdit,
  onDelete,
  onDismissActions,
  showActionsTooltip = false,
  canEdit = false,
  canDelete = false
}: MessageBubbleProps): JSX.Element {
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const { theme } = useAppTheme();
  const bubbleColor = isMine ? theme.colors.messageMine : theme.colors.messageOther;
  const textColor = isMine ? "#FFFFFF" : theme.colors.textPrimary;
  const metaColor = isMine ? "#DCE7FF" : theme.colors.textMuted;
  const attachmentUrl = message.attachment?.publicUrl ?? null;
  const mimeType = (message.attachment?.mimeType ?? "").toLowerCase();
  const isImageAttachment = mimeType.startsWith("image/") || message.type === "image";
  const callSummary = message.type === "system" ? getCallSummaryPresentation(message.body) : null;
  const showWebActionsButton = Platform.OS === "web" && Boolean(onOpenActions);

  const openAttachment = (): void => {
    if (!attachmentUrl) {
      return;
    }
    Linking.openURL(attachmentUrl).catch(() => undefined);
  };

  const openLink = (url: string): void => {
    Linking.openURL(url).catch(() => undefined);
  };

  const openImagePreview = (): void => {
    if (!attachmentUrl) {
      return;
    }
    setImagePreviewVisible(true);
  };

  const textSegments = buildTextSegments(message.body);

  return (
    <>
      <View style={[styles.row, { justifyContent: isMine ? "flex-end" : "flex-start" }]}>
        <Pressable
          onLongPress={onLongPress}
          onPress={showActionsTooltip ? onDismissActions : undefined}
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderColor: isMine ? theme.colors.messageMine : theme.colors.border,
              alignItems: "flex-start"
            }
          ]}
        >
          {!isMine || showWebActionsButton ? (
            <View style={styles.topRow}>
              {!isMine ? <Text style={[styles.sender, { color: theme.colors.textMuted }]}>{senderName}</Text> : <View />}
              {showWebActionsButton ? (
                <Pressable
                  onPress={onOpenActions}
                  hitSlop={8}
                  style={({ pressed }) => [styles.actionsButton, pressed && styles.actionsButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open message actions"
                >
                  <Feather name="more-horizontal" size={14} color={metaColor} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {showWebActionsButton && showActionsTooltip && (canEdit || canDelete) ? (
            <View style={[styles.tooltip, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              {canEdit ? (
                <Pressable
                  onPress={onEdit}
                  style={({ pressed }) => [
                    styles.tooltipAction,
                    pressed && { backgroundColor: theme.colors.surfaceMuted }
                  ]}
                >
                  <Text style={[styles.tooltipActionText, { color: theme.colors.textPrimary }]}>Edit</Text>
                </Pressable>
              ) : null}
              {canDelete ? (
                <Pressable
                  onPress={onDelete}
                  style={({ pressed }) => [
                    styles.tooltipAction,
                    pressed && { backgroundColor: theme.colors.danger + "12" }
                  ]}
                >
                  <Text style={[styles.tooltipActionText, { color: theme.colors.danger }]}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {message.isDeleted ? (
            <Text style={[styles.deletedText, { color: isMine ? "#D7E2FF" : metaColor }]}>
              This message was deleted
            </Text>
          ) : callSummary ? (
            <View
              style={[
                styles.callCard,
                {
                  backgroundColor: isMine ? "rgba(255,255,255,0.12)" : theme.colors.surfaceMuted,
                  borderColor:
                    callSummary.tone === "danger"
                      ? isMine
                        ? "rgba(255,130,130,0.65)"
                        : `${theme.colors.danger}38`
                      : isMine
                        ? "rgba(255,255,255,0.24)"
                        : theme.colors.border
                }
              ]}
            >
              <View
                style={[
                  styles.callIconWrap,
                  {
                    backgroundColor:
                      callSummary.tone === "danger"
                        ? isMine
                          ? "rgba(255,130,130,0.25)"
                          : `${theme.colors.danger}1A`
                        : isMine
                          ? "rgba(255,255,255,0.16)"
                          : theme.colors.surface
                  }
                ]}
              >
                <Feather
                  name={callSummary.icon}
                  size={15}
                  color={
                    callSummary.tone === "danger"
                      ? theme.colors.danger
                      : isMine
                        ? "#FFFFFF"
                        : theme.colors.textPrimary
                  }
                />
              </View>
              <View style={styles.callCopy}>
                <Text style={[styles.callTitle, { color: textColor }]}>{callSummary.title}</Text>
                <Text style={[styles.callSubtitle, { color: metaColor }]}>{callSummary.subtitle}</Text>
              </View>
            </View>
          ) : message.type === "voice" ? (
            <VoiceMessageBubble
              message={message}
              textColor={textColor}
              mutedTextColor={isMine ? "#DCE7FF" : theme.colors.textMuted}
              accentColor={theme.colors.accent}
            />
          ) : message.type === "video_note" ? (
            <VideoNoteBubble
              message={message}
              textColor={textColor}
              mutedTextColor={isMine ? "#DCE7FF" : theme.colors.textMuted}
            />
          ) : isImageAttachment ? (
            attachmentUrl ? (
              <Pressable onPress={openImagePreview} style={styles.imageWrap}>
                <Image source={{ uri: attachmentUrl }} style={styles.imagePreview} resizeMode="cover" />
              </Pressable>
            ) : (
              <View style={styles.voiceRow}>
                <Feather name="image" size={14} color={textColor} />
                <Text style={[styles.body, { color: textColor }]}>Unavailable attachment</Text>
              </View>
            )
          ) : message.type === "file" || message.attachment ? (
            <View style={styles.fileWrap}>
              <View style={styles.voiceRow}>
                <Feather name="file-text" size={14} color={textColor} />
                <Text numberOfLines={2} style={[styles.body, styles.fileNameText, { color: textColor }]}>
                  {message.attachment?.name ?? "Document"} - {message.attachment?.sizeLabel ?? "0.0 MB"}
                </Text>
              </View>
              {attachmentUrl ? (
                <Text style={[styles.fileLink, { color: textColor }]} onPress={openAttachment}>
                  Download file
                </Text>
              ) : (
                <Text style={[styles.metaText, { color: metaColor }]}>
                  Unavailable attachment
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.body, { color: textColor }]}>
              {textSegments.map((segment, index) =>
                segment.url ? (
                  <Text
                    key={`link_${index}`}
                    onPress={() => {
                      if (segment.url) {
                        openLink(segment.url);
                      }
                    }}
                    style={[styles.linkText, { color: isMine ? "#FFFFFF" : theme.colors.accent }]}
                  >
                    {segment.text}
                  </Text>
                ) : (
                  <Text key={`text_${index}`}>{segment.text}</Text>
                )
              )}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: metaColor }]}>
              {formatMessageDate(message.createdAt)}
            </Text>
            {message.editedAt ? (
              <Text style={[styles.metaText, { color: metaColor }]}>edited</Text>
            ) : null}
            {isMine ? <Feather name={statusIcon[message.status]} size={12} color="#DCE7FF" /> : null}
          </View>
        </Pressable>
      </View>

      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <Pressable style={styles.previewOverlay} onPress={() => setImagePreviewVisible(false)}>
          <View style={styles.previewContent}>
            {attachmentUrl ? (
              <Image source={{ uri: attachmentUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.previewCloseButton} onPress={() => setImagePreviewVisible(false)}>
              <Feather name="x" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 4
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    maxWidth: "84%",
    minWidth: 128,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  sender: {
    fontSize: 12,
    fontWeight: "600"
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },
  actionsButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    marginLeft: 8,
    width: 22
  },
  actionsButtonPressed: {
    opacity: 0.75
  },
  tooltip: {
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 110,
    overflow: "hidden",
    position: "absolute",
    right: 4,
    top: 34,
    zIndex: 50
  },
  tooltipAction: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  tooltipActionText: {
    fontSize: 13,
    fontWeight: "700"
  },
  body: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19
  },
  linkText: {
    textDecorationLine: "underline"
  },
  fileNameText: {
    flex: 1
  },
  deletedText: {
    fontSize: 13,
    fontStyle: "italic"
  },
  callCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 9,
    paddingVertical: 8
  },
  callIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  callCopy: {
    flex: 1,
    gap: 1
  },
  callTitle: {
    fontSize: 13,
    fontWeight: "700"
  },
  callSubtitle: {
    fontSize: 11,
    fontWeight: "500"
  },
  imageWrap: {
    borderRadius: 10,
    overflow: "hidden"
  },
  imagePreview: {
    borderRadius: 10,
    height: 180,
    width: 180
  },
  fileWrap: {
    gap: 4
  },
  fileLink: {
    fontSize: 12,
    textDecorationLine: "underline"
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-end"
  },
  metaText: {
    fontSize: 10
  },
  voiceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  previewOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    flex: 1,
    justifyContent: "center",
    padding: 16
  },
  previewContent: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%"
  },
  previewImage: {
    height: "100%",
    maxHeight: 740,
    maxWidth: 1040,
    width: "100%"
  },
  previewCloseButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 36
  }
});
