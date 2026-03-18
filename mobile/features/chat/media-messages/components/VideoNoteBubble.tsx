import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ChatMessage } from "@/types";

interface VideoNoteBubbleProps {
  message: ChatMessage;
  textColor: string;
  mutedTextColor: string;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const formatDuration = (durationMs?: number): string => {
  if (!isFiniteNumber(durationMs) || durationMs <= 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export function VideoNoteBubble({ message, textColor, mutedTextColor }: VideoNoteBubbleProps): JSX.Element {
  const metadata = (message.attachment?.metadataJson ?? {}) as Record<string, unknown>;
  const attachmentUrl = message.attachment?.publicUrl ?? message.attachment?.uri ?? null;
  const posterUrl = typeof metadata.thumbnail_url === "string" ? metadata.thumbnail_url : undefined;
  const metadataDuration = isFiniteNumber(metadata.duration_ms) ? metadata.duration_ms : 0;
  const videoRef = useRef<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [durationMs, setDurationMs] = useState<number>(metadataDuration);
  const [positionMs, setPositionMs] = useState<number>(0);

  const togglePlayback = async () => {
    if (!videoRef.current) {
      return;
    }
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      setStatusLabel(error instanceof Error ? error.message : "Playback failed.");
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setStatusLabel("Unable to load video note.");
      }
      return;
    }
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis ?? 0);
    if (typeof status.durationMillis === "number") {
      setDurationMs(status.durationMillis);
    }
    if (status.didJustFinish) {
      setStatusLabel("");
    }
  };

  const durationLabel = useMemo(
    () => formatDuration(positionMs > 0 ? positionMs : durationMs || metadataDuration),
    [durationMs, metadataDuration, positionMs],
  );

  if (!attachmentUrl) {
    return <Text style={[styles.errorText, { color: textColor }]}>Video note unavailable.</Text>;
  }

  return (
    <View style={styles.root}>
      <Pressable onPress={togglePlayback} style={styles.circleWrap}>
        <Video
          ref={videoRef}
          source={{ uri: attachmentUrl }}
          resizeMode={ResizeMode.COVER}
          style={styles.video}
          useNativeControls={false}
          shouldPlay={false}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          posterSource={posterUrl ? { uri: posterUrl } : undefined}
          usePoster={Boolean(posterUrl)}
        />
        {!isPlaying ? (
          <View style={styles.overlayPlay}>
            <Feather name="play" size={20} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
      <Text style={[styles.metaText, { color: mutedTextColor }]}>{durationLabel}</Text>
      {statusLabel ? <Text style={[styles.errorText, { color: textColor }]}>{statusLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "flex-start",
    gap: 4,
  },
  circleWrap: {
    borderRadius: 999,
    height: 156,
    overflow: "hidden",
    width: 156,
  },
  video: {
    borderRadius: 999,
    height: "100%",
    width: "100%",
  },
  overlayPlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    borderRadius: 999,
    height: "100%",
    justifyContent: "center",
    position: "absolute",
    width: "100%",
  },
  metaText: {
    fontSize: 11,
  },
  errorText: {
    fontSize: 11,
    opacity: 0.92,
  },
});
