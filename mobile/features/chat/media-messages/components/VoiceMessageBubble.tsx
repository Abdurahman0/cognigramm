import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ChatMessage } from "@/types";

interface VoiceMessageBubbleProps {
  message: ChatMessage;
  textColor: string;
  mutedTextColor: string;
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

const fallbackWaveform = [28, 42, 35, 56, 43, 61, 39, 45, 31, 48, 40, 34];

export function VoiceMessageBubble({
  message,
  textColor,
  mutedTextColor,
  accentColor,
}: VoiceMessageBubbleProps): JSX.Element {
  const attachmentUrl = message.attachment?.publicUrl ?? message.attachment?.uri ?? null;
  const metadata = (message.attachment?.metadataJson ?? {}) as Record<string, unknown>;
  const metadataDuration = isFiniteNumber(metadata.duration_ms) ? metadata.duration_ms : undefined;
  const metadataWaveform = Array.isArray(metadata.waveform)
    ? metadata.waveform.filter((value): value is number => isFiniteNumber(value))
    : undefined;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number>(metadataDuration ?? 0);
  const [playbackError, setPlaybackError] = useState<string>("");

  const waveform = metadataWaveform && metadataWaveform.length > 0 ? metadataWaveform : fallbackWaveform;

  const playbackProgress = useMemo(() => {
    if (!durationMs || durationMs <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, positionMs / durationMs));
  }, [durationMs, positionMs]);

  const cleanupSound = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) {
      return;
    }
    try {
      await sound.unloadAsync();
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => () => {
    cleanupSound().catch(() => undefined);
  }, [cleanupSound]);

  const togglePlayback = useCallback(async () => {
    if (!attachmentUrl) {
      setPlaybackError("Voice file is unavailable.");
      return;
    }
    setPlaybackError("");
    setIsLoading(true);
    try {
      let sound = soundRef.current;
      if (!sound) {
        const { sound: createdSound, status } = await Audio.Sound.createAsync(
          { uri: attachmentUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 250 },
        );
        sound = createdSound;
        soundRef.current = createdSound;
        if (status.isLoaded && typeof status.durationMillis === "number") {
          setDurationMs(status.durationMillis);
        }
        createdSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            return;
          }
          setIsPlaying(status.isPlaying);
          setPositionMs(status.positionMillis ?? 0);
          if (typeof status.durationMillis === "number") {
            setDurationMs(status.durationMillis);
          }
        });
      }
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        throw new Error("Unable to load voice message.");
      }
      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : "Playback failed.");
    } finally {
      setIsLoading(false);
    }
  }, [attachmentUrl]);

  return (
    <View style={styles.root}>
      <Pressable onPress={togglePlayback} style={styles.controlsRow}>
        <View style={[styles.playButton, { backgroundColor: accentColor }]}>
          <Feather name={isPlaying ? "pause" : "play"} size={14} color="#FFFFFF" />
        </View>
        <View style={styles.timelineWrap}>
          <View style={styles.waveformRow}>
            {waveform.slice(0, 24).map((value, index) => {
              const raw = value > 1 ? value / 100 : value;
              const normalized = Math.max(0.18, Math.min(1, raw));
              const activeThreshold = (index + 1) / Math.min(24, waveform.length || 1);
              return (
                <View
                  key={`${index}_${value}`}
                  style={[
                    styles.waveformBar,
                    {
                      height: Math.round(normalized * 22),
                      backgroundColor: activeThreshold <= playbackProgress ? accentColor : mutedTextColor,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: mutedTextColor }]}>
              {formatDuration(positionMs || durationMs || metadataDuration)}
            </Text>
            {isLoading ? (
              <Text style={[styles.metaText, { color: mutedTextColor }]}>Loading...</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {playbackError ? <Text style={[styles.errorText, { color: textColor }]}>{playbackError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
    width: 220,
  },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  playButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  timelineWrap: {
    flex: 1,
    gap: 4,
  },
  waveformRow: {
    alignItems: "flex-end",
    columnGap: 2,
    flexDirection: "row",
    height: 24,
  },
  waveformBar: {
    borderRadius: 999,
    width: 3,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 11,
  },
  errorText: {
    fontSize: 11,
    opacity: 0.9,
  },
});
