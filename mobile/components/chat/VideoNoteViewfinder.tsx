import { Platform, StyleSheet, View } from "react-native";
import { useEffect, useRef } from "react";

import { useAppTheme } from "@/hooks/useAppTheme";

interface VideoNoteViewfinderProps {
  /** The live capture stream; typed loosely because it goes straight to the element. */
  stream: unknown;
}

const SIZE = 64;

/**
 * What the camera is seeing, while it is being recorded.
 *
 * Filming into a button with no picture is guesswork, so the composer shows the take in
 * the same round frame the note will be sent in. Web only: the native path hands the
 * capture to the system camera UI, which shows its own preview.
 */
export function VideoNoteViewfinder({ stream }: VideoNoteViewfinderProps): JSX.Element | null {
  const { theme } = useAppTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !videoRef.current) {
      return;
    }
    videoRef.current.srcObject = (stream ?? null) as MediaStream | null;
    const playback = videoRef.current.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => undefined);
    }
  }, [stream]);

  if (Platform.OS !== "web" || !stream) {
    return null;
  }

  return (
    <View
      style={[styles.frame, { borderColor: theme.colors.danger }]}
      // Mirrored, because a viewfinder of yourself should behave like a mirror.
      pointerEvents="none"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 999,
    borderWidth: 2,
    height: SIZE,
    overflow: "hidden",
    width: SIZE
  }
});
