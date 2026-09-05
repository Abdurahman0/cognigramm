import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useMediaUri } from "@/hooks/useMediaUri";
import type { ChatMessage } from "@/types";

interface VoiceMessageBubbleProps {
  message: ChatMessage;
  textColor: string;
  mutedTextColor: string;
  /** Fill of the play button and the played portion of the waveform. */
  accentColor: string;
  /** Glyph drawn on that fill; needed because your own bubble is already accent. */
  onAccentColor: string;
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
/** How many bars the timeline draws, whatever the source waveform length. */
const BAR_COUNT = 28;

export function VoiceMessageBubble({
  message,
  textColor,
  mutedTextColor,
  accentColor,
  onAccentColor,
}: VoiceMessageBubbleProps): JSX.Element {
  // Leased rather than read off the message: a signed S3 URL dies in about
  // fifteen minutes, and a chat left open outlives that easily.
  const { uri: leasedUrl, retry: retryAttachment } = useMediaUri(message.attachment);
  const attachmentUrl = leasedUrl ?? null;
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
      // The usual cause is an expired signature rather than a broken file, so
      // re-sign once and let the next press play it.
      retryAttachment();
      await cleanupSound().catch(() => undefined);
      setPlaybackError(error instanceof Error ? error.message : "Playback failed.");
    } finally {
      setIsLoading(false);
    }
  }, [attachmentUrl, cleanupSound, retryAttachment]);

  const bars = waveform.slice(0, BAR_COUNT);

  return (
    <View style={styles.root}>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={togglePlayback}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Pause voice message" : "Play voice message"}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: accentColor, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={onAccentColor} />
          ) : (
            <Feather
              name={isPlaying ? "pause" : "play"}
              size={18}
              color={onAccentColor}
              style={isPlaying ? undefined : styles.playGlyph}
            />
          )}
        </Pressable>

        <View style={styles.timelineWrap}>
          {/* Bars carry the playhead: everything left of it is filled, the bar under it
              is highlighted, and the rest stays quiet. */}
          <View style={styles.waveformRow}>
            {bars.map((value, index) => {
              const raw = value > 1 ? value / 100 : value;
              const normalized = Math.max(0.2, Math.min(1, raw));
              const barPosition = (index + 0.5) / bars.length;
              const played = barPosition <= playbackProgress;
              const isHead = isPlaying && Math.abs(barPosition - playbackProgress) < 0.5 / bars.length;
              return (
                <View
                  key={`${index}_${value}`}
                  style={[
                    styles.waveformBar,
                    {
                      height: Math.round(normalized * 26),
                      backgroundColor: played ? accentColor : mutedTextColor,
                      opacity: played ? 1 : 0.45,
                      transform: [{ scaleY: isHead ? 1.18 : 1 }],
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
            <Text style={[styles.metaText, { color: mutedTextColor }]}>
              {isLoading ? "Loading…" : formatDuration(durationMs || metadataDuration)}
            </Text>
          </View>
        </View>
      </View>
      {playbackError ? <Text style={[styles.errorText, { color: textColor }]}>{playbackError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
    // A fixed width overflowed the bubble on a narrow screen, where the bubble itself is
    // capped at 78% of the viewport. It now fills what it is given, within a range.
    maxWidth: 244,
    minWidth: 180,
    width: "100%",
  },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  playButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  /* The play triangle is visually off-centre in its own box; nudge it back. */
  playGlyph: {
    marginLeft: 2,
  },
  timelineWrap: {
    flex: 1,
    gap: 4,
  },
  waveformRow: {
    alignItems: "center",
    columnGap: 2,
    flexDirection: "row",
    height: 28,
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
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    opacity: 0.9,
  },
});
