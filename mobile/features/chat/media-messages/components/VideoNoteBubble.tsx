import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useMediaUri } from "@/hooks/useMediaUri";
import type { ChatMessage } from "@/types";

interface VideoNoteBubbleProps {
  message: ChatMessage;
  textColor: string;
  /** Colour of the progress ring drawn around the note. */
  accentColor: string;
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

export function VideoNoteBubble({
  message,
  textColor,
  accentColor
}: VideoNoteBubbleProps): JSX.Element {
  const metadata = (message.attachment?.metadataJson ?? {}) as Record<string, unknown>;
  const { uri: leasedUrl, retry: retryAttachment } = useMediaUri(message.attachment);
  const attachmentUrl = leasedUrl ?? null;
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

  const progress = durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;

  return (
    <View style={styles.root}>
      <Pressable
        onPress={togglePlayback}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause video note" : "Play video note"}
        style={styles.circleWrap}
      >
        <Video
          ref={videoRef}
          source={{ uri: attachmentUrl }}
          resizeMode={ResizeMode.COVER}
          style={styles.video}
          // expo-av styles its own container on web; without this the inner <video>
          // keeps its natural size (640x360 here) and the circle shows that frame's
          // top-left corner instead of a centred crop.
          videoStyle={styles.videoElement}
          useNativeControls={false}
          shouldPlay={false}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          // A signed URL that expired while the chat was open reports here.
          onError={retryAttachment}
          posterSource={posterUrl ? { uri: posterUrl } : undefined}
          usePoster={Boolean(posterUrl)}
        />

        {/* Progress runs around the rim rather than under the circle, so the note stays
            one round object while it plays. Each quarter of the ring lights in turn. */}
        <View pointerEvents="none" style={[styles.ring, { borderColor: `${accentColor}2E` }]} />
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderTopColor: accentColor,
              borderRightColor: progress > 0.25 ? accentColor : "transparent",
              borderBottomColor: progress > 0.5 ? accentColor : "transparent",
              borderLeftColor: progress > 0.75 ? accentColor : "transparent",
              transform: [{ rotate: `${progress * 360}deg` }],
              opacity: progress > 0 ? 1 : 0
            }
          ]}
        />

        {!isPlaying ? (
          <View style={styles.overlayPlay}>
            <View style={styles.playGlyph}>
              <Feather name="play" size={22} color="#FFFFFF" />
            </View>
          </View>
        ) : null}

        {/* The duration rides on the note itself, the way a camera timer does. */}
        <View style={styles.durationPill}>
          <Feather name={isPlaying ? "pause" : "video"} size={11} color="#FFFFFF" />
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      </Pressable>
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
    height: 168,
    justifyContent: "flex-end",
    width: 168,
  },
  video: {
    borderRadius: 999,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  videoElement: {
    height: "100%",
    width: "100%"
  },
  ring: {
    borderRadius: 999,
    borderWidth: 3,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  overlayPlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.34)",
    borderRadius: 999,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  playGlyph: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 999,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    paddingLeft: 3,
    width: 52,
  },
  durationPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    opacity: 0.92,
  },
});
