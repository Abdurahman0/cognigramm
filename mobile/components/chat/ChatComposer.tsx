import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

interface ChatComposerProps {
  keyboardVisible?: boolean;
  replyToText?: string;
  onClearReply?: () => void;
  onSend: (body: string) => void;
  onSendAttachment: () => void;
}

const emojiCatalog = [
  "\u{1F600}",
  "\u{1F601}",
  "\u{1F602}",
  "\u{1F60A}",
  "\u{1F44D}",
  "\u{1F44F}",
  "\u{1F64F}",
  "\u{1F525}",
  "\u{2705}",
  "\u{1F3AF}",
  "\u{1F4BC}",
  "\u{1F4CC}",
  "\u{1F4CE}",
  "\u{1F680}",
  "\u{2757}",
  "\u{23F0}"
];

export function ChatComposer({
  keyboardVisible = false,
  replyToText,
  onClearReply,
  onSend,
  onSendAttachment
}: ChatComposerProps): JSX.Element {
  const { theme } = useAppTheme();
  const minInputHeight = Platform.OS === "ios" ? 22 : 20;
  const [text, setText] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState(minInputHeight);

  const handleSend = () => {
    const value = text.trim();
    if (!value) {
      return;
    }
    onSend(value);
    setText("");
    setInputHeight(minInputHeight);
    setEmojiPickerOpen(false);
    Keyboard.dismiss();
  };

  const appendEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`);
  };

  return (
    <View style={[styles.root, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      {replyToText ? (
        <View style={[styles.replyWrap, { backgroundColor: theme.colors.surfaceMuted }]}>
          <Text numberOfLines={1} style={[styles.replyText, { color: theme.colors.textSecondary }]}>
            Replying to: {replyToText}
          </Text>
          <Pressable onPress={onClearReply} hitSlop={8}>
            <Feather name="x" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {emojiPickerOpen ? (
        <View style={[styles.emojiPanel, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
          {emojiCatalog.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => appendEmoji(emoji)}
              style={({ pressed }) => [
                styles.emojiButton,
                { backgroundColor: pressed ? theme.colors.surface : "transparent" }
              ]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.composerShell,
          keyboardVisible && styles.composerShellKeyboardOpen,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }
        ]}
      >
        <Pressable
          onPress={() => setEmojiPickerOpen((open) => !open)}
          style={[styles.iconButton, keyboardVisible && styles.iconButtonKeyboardOpen]}
          hitSlop={8}
        >
          <Feather name="smile" size={20} color={theme.colors.textSecondary} />
        </Pressable>

        <View style={[styles.inputWrap, keyboardVisible && styles.inputWrapKeyboardOpen]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            blurOnSubmit={false}
            onFocus={() => setEmojiPickerOpen(false)}
            onContentSizeChange={(event) => {
              const nextHeight = Math.max(minInputHeight, Math.min(94, event.nativeEvent.contentSize.height));
              setInputHeight(nextHeight);
            }}
            style={[
              styles.input,
              keyboardVisible && styles.inputKeyboardOpen,
              {
                color: theme.colors.textPrimary,
                height: inputHeight
              }
            ]}
          />
        </View>

        <Pressable
          onPress={onSendAttachment}
          style={[styles.iconButton, keyboardVisible && styles.iconButtonKeyboardOpen]}
          hitSlop={8}
        >
          <Feather name="paperclip" size={20} color={theme.colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={handleSend}
          style={[
            styles.sendButton,
            keyboardVisible && styles.sendButtonKeyboardOpen,
            {
              backgroundColor: text.trim().length > 0 ? theme.colors.accent : theme.colors.textMuted
            }
          ]}
          hitSlop={8}
        >
          <Feather name="send" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4
  },
  composerShell: {
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6
  },
  composerShellKeyboardOpen: {
    paddingVertical: 7
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 32
  },
  iconButtonKeyboardOpen: {
    alignSelf: "center"
  },
  inputWrap: {
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 3,
    minHeight: 34
  },
  inputWrapKeyboardOpen: {
    minHeight: 36
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 94,
    minHeight: 20,
    paddingBottom: Platform.OS === "ios" ? 2 : 0,
    paddingHorizontal: 6,
    paddingTop: 0,
    textAlignVertical: "center"
  },
  inputKeyboardOpen: {
    paddingBottom: 1,
    paddingTop: 1
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    marginLeft: 6,
    width: 34
  },
  sendButtonKeyboardOpen: {
    alignSelf: "center"
  },
  replyWrap: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  replyText: {
    flex: 1,
    fontSize: 12,
    marginRight: 8
  },
  emojiPanel: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 8
  },
  emojiButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  emojiText: {
    fontSize: 21
  }
});
