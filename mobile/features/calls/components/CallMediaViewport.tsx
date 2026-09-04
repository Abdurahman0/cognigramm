import { Feather } from "@expo/vector-icons";
import type { CSSProperties, ComponentType } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common";
import { AppText, GlassView } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { CallRuntimeState, CallType } from "@/features/calls/types";

interface RtcViewProps {
  streamURL: string;
  mirror?: boolean;
  objectFit?: "cover" | "contain";
  style?: object;
}

type StreamWithUrl = { toURL?: () => string } | null;
type BrowserVideoRef = HTMLVideoElement | null;
type BrowserAudioRef = HTMLAudioElement | null;

const isExpoGoRuntime = (): boolean => {
  try {
    const constants = require("expo-constants") as {
      appOwnership?: string;
      default?: { appOwnership?: string };
    };
    const ownership = constants.default?.appOwnership ?? constants.appOwnership;
    return ownership === "expo";
  } catch {
    return false;
  }
};

const loadRtcView = (): ComponentType<RtcViewProps> | null => {
  if (Platform.OS === "web") {
    return null;
  }
  if (isExpoGoRuntime()) {
    return null;
  }
  try {
    const module = require("react-native-webrtc") as { RTCView?: ComponentType<RtcViewProps> };
    return module.RTCView ?? null;
  } catch {
    return null;
  }
};

const toStreamUrl = (stream: unknown): string => {
  const typedStream = stream as StreamWithUrl;
  if (!typedStream || typeof typedStream.toURL !== "function") {
    return "";
  }
  return typedStream.toURL() ?? "";
};

const isBrowserMediaStream = (stream: unknown): stream is MediaStream => {
  return typeof MediaStream !== "undefined" && stream instanceof MediaStream;
};

interface CallMediaViewportProps {
  callType: CallType;
  peerName: string;
  peerAvatar?: string;
  runtime: CallRuntimeState;
  /** Status or duration line shown under the peer name while there is no remote video. */
  caption?: string;
}

export function CallMediaViewport({
  callType,
  peerName,
  peerAvatar,
  runtime,
  caption
}: CallMediaViewportProps): JSX.Element {
  const { theme } = useAppTheme();
  const showVideoLayout = callType === "video";
  const isWeb = Platform.OS === "web";
  const remoteHasVideo = runtime.remoteMedia.hasStream && runtime.remoteMedia.hasVideo;
  const localPreviewEnabled = showVideoLayout && runtime.localMedia.hasStream && runtime.isCameraEnabled;
  const remoteWebStream = isBrowserMediaStream(runtime.remoteMedia.stream)
    ? runtime.remoteMedia.stream
    : null;
  const localWebStream = isBrowserMediaStream(runtime.localMedia.stream)
    ? runtime.localMedia.stream
    : null;
  const remoteStreamUrl = toStreamUrl(runtime.remoteMedia.stream);
  const localStreamUrl = toStreamUrl(runtime.localMedia.stream);
  const shouldLoadRenderer =
    !isWeb && showVideoLayout && (remoteHasVideo || localPreviewEnabled);
  const RtcView = useMemo(() => {
    if (!shouldLoadRenderer) {
      return null;
    }
    return loadRtcView();
  }, [shouldLoadRenderer]);
  const canRenderNativeRtcVideo = Boolean(RtcView);
  const canRenderWebVideo = isWeb && typeof window !== "undefined";
  const remoteVideoRef = useRef<BrowserVideoRef>(null);
  const localVideoRef = useRef<BrowserVideoRef>(null);
  const remoteAudioRef = useRef<BrowserAudioRef>(null);
  const shouldRenderWebAudio = isWeb && Boolean(remoteWebStream) && (!showVideoLayout || !remoteHasVideo);

  useEffect(() => {
    if (!isWeb || !remoteVideoRef.current) {
      return;
    }
    remoteVideoRef.current.srcObject = remoteWebStream;
  }, [isWeb, remoteWebStream]);

  useEffect(() => {
    if (!isWeb || !localVideoRef.current) {
      return;
    }
    localVideoRef.current.srcObject = localWebStream;
  }, [isWeb, localWebStream]);

  useEffect(() => {
    if (!isWeb || !remoteAudioRef.current) {
      return;
    }
    remoteAudioRef.current.srcObject = remoteWebStream;
    const playback = remoteAudioRef.current.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => undefined);
    }
  }, [isWeb, remoteWebStream]);

  // Remote audio arrives through whichever element is mounted, so the call's output
  // level is applied to both rather than to the audio tag alone.
  useEffect(() => {
    if (!isWeb) {
      return;
    }
    const level = Math.max(0, Math.min(1, runtime.outputVolume));
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = level;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = level;
    }
  }, [isWeb, runtime.outputVolume, remoteWebStream, remoteHasVideo]);

  const webVideoStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  };

  const placeholderCaption = showVideoLayout
    ? isWeb
      ? canRenderWebVideo
        ? "Waiting for remote video…"
        : "This browser cannot render live video."
      : canRenderNativeRtcVideo
      ? "Waiting for remote video…"
      : "Video renderer unavailable in this build."
    : "Audio call";

  const hero = (
    <View style={styles.centeredContent}>
      <Avatar uri={peerAvatar} name={peerName} size={136} shape="squircle" />
      <AppText variant="title1" style={styles.peerName}>
        {peerName}
      </AppText>
      <AppText variant="subhead" tone="secondary" style={styles.peerMeta}>
        {caption ?? placeholderCaption}
      </AppText>
    </View>
  );

  return (
    <View style={styles.root}>
      {shouldRenderWebAudio ? <audio autoPlay playsInline ref={remoteAudioRef} /> : null}
      <GlassView
        material="ultraThin"
        radius={theme.radius.panel}
        bordered={false}
        highlight
        style={styles.remotePane}
      >
        {showVideoLayout ? (
          isWeb && remoteHasVideo && remoteWebStream && canRenderWebVideo ? (
            <video autoPlay playsInline ref={remoteVideoRef} style={webVideoStyle} />
          ) : !isWeb && remoteHasVideo && remoteStreamUrl && canRenderNativeRtcVideo && RtcView ? (
            <RtcView streamURL={remoteStreamUrl} objectFit="cover" style={styles.rtcView} />
          ) : (
            hero
          )
        ) : (
          hero
        )}

        {showVideoLayout ? (
          <GlassView
            material="thick"
            radius={theme.radius.lg}
            elevation="soft"
            style={styles.localPreview}
          >
            {isWeb && localPreviewEnabled && localWebStream && canRenderWebVideo ? (
              <video autoPlay muted playsInline ref={localVideoRef} style={webVideoStyle} />
            ) : !isWeb && localPreviewEnabled && localStreamUrl && canRenderNativeRtcVideo && RtcView ? (
              <RtcView streamURL={localStreamUrl} mirror objectFit="cover" style={styles.rtcView} />
            ) : (
              <View style={styles.localPreviewPlaceholder}>
                <Feather
                  name={canRenderWebVideo || canRenderNativeRtcVideo ? "video-off" : "alert-triangle"}
                  size={16}
                  color={theme.colors.textMuted}
                />
                <AppText variant="caption2" tone="tertiary" style={styles.localPreviewText}>
                  {canRenderWebVideo || canRenderNativeRtcVideo ? "Camera off" : "Renderer unavailable"}
                </AppText>
              </View>
            )}
          </GlassView>
        ) : null}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 280
  },
  remotePane: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  centeredContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28
  },
  peerName: {
    marginTop: 20
  },
  peerMeta: {
    marginTop: 4
  },
  localPreview: {
    bottom: 14,
    height: 116,
    overflow: "hidden",
    position: "absolute",
    right: 14,
    width: 158
  },
  rtcView: {
    height: "100%",
    width: "100%"
  },
  localPreviewPlaceholder: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%"
  },
  localPreviewText: {
    marginTop: 4
  }
});
