import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import type { ChatMessage } from "@/types";
import { formatMessageDate } from "@/utils/date";

interface MessageBubbleProps {
  message: ChatMessage;
  senderName: string;
  isMine: boolean;
  onLongPress?: () => void;
}

const statusIcon: Record<ChatMessage["status"], keyof typeof Feather.glyphMap> = {
  sending: "clock",
  sent: "check",
  delivered: "check-circle",
  seen: "eye"
};

export function MessageBubble({
  message,
  senderName,
  isMine,
  onLongPress
}: MessageBubbleProps): JSX.Element {
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const { theme } = useAppTheme();
  const bubbleColor = isMine ? theme.colors.messageMine : theme.colors.messageOther;
  const textColor = isMine ? "#FFFFFF" : theme.colors.textPrimary;
  const attachmentUrl = message.attachment?.publicUrl ?? null;
  const mimeType = (message.attachment?.mimeType ?? "").toLowerCase();
  const isImageAttachment = mimeType.startsWith("image/") || message.type === "image";

  const openAttachment = (): void => {
    if (!attachmentUrl) {
      return;
    }
    Linking.openURL(attachmentUrl).catch(() => undefined);
  };

  const openImagePreview = (): void => {
    if (!attachmentUrl) {
      return;
    }
    setImagePreviewVisible(true);
  };

  return (
    <>
      <View style={[styles.row, { justifyContent: isMine ? "flex-end" : "flex-start" }]}>
        <Pressable
          onLongPress={onLongPress}
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderColor: isMine ? theme.colors.messageMine : theme.colors.border,
              alignItems: "flex-start"
            }
          ]}
        >
          {!isMine ? <Text style={[styles.sender, { color: theme.colors.textMuted }]}>{senderName}</Text> : null}
          {message.isDeleted ? (
            <Text style={[styles.deletedText, { color: isMine ? "#D7E2FF" : theme.colors.textMuted }]}>
              This message was deleted
            </Text>
          ) : message.type === "voice" ? (
            <View style={styles.voiceRow}>
              <Feather name="mic" size={14} color={textColor} />
              <Text style={[styles.body, { color: textColor }]}>Voice note (placeholder)</Text>
            </View>
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
                <Text style={[styles.metaText, { color: isMine ? "#DCE7FF" : theme.colors.textMuted }]}>
                  Unavailable attachment
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.body, { color: textColor }]}>{message.body}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: isMine ? "#DCE7FF" : theme.colors.textMuted }]}>
              {formatMessageDate(message.createdAt)}
            </Text>
            {message.editedAt ? (
              <Text style={[styles.metaText, { color: isMine ? "#DCE7FF" : theme.colors.textMuted }]}>edited</Text>
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
  body: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19
  },
  fileNameText: {
    flex: 1
  },
  deletedText: {
    fontSize: 13,
    fontStyle: "italic"
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
