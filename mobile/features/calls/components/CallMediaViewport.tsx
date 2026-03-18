import { Feather } from "@expo/vector-icons";
import type { CSSProperties, ComponentType } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common";
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
}

export function CallMediaViewport({
  callType,
  peerName,
  peerAvatar,
  runtime
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

  const webVideoStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  };

  return (
    <View style={styles.root}>
      {shouldRenderWebAudio ? <audio autoPlay playsInline ref={remoteAudioRef} /> : null}
      <View style={[styles.remotePane, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        {showVideoLayout ? (
          isWeb && remoteHasVideo && remoteWebStream && canRenderWebVideo ? (
            <video autoPlay playsInline ref={remoteVideoRef} style={webVideoStyle} />
          ) : !isWeb && remoteHasVideo && remoteStreamUrl && canRenderNativeRtcVideo && RtcView ? (
            <RtcView streamURL={remoteStreamUrl} objectFit="cover" style={styles.rtcView} />
          ) : (
            <View style={styles.centeredContent}>
              <Avatar uri={peerAvatar} name={peerName} size={74} />
              <Text style={[styles.peerName, { color: theme.colors.textPrimary }]}>{peerName}</Text>
              <Text style={[styles.peerMeta, { color: theme.colors.textMuted }]}>
                {isWeb
                  ? canRenderWebVideo
                    ? "Waiting for remote video..."
                    : "This browser cannot render live video."
                  : canRenderNativeRtcVideo
                  ? "Waiting for remote video..."
                  : "Video renderer unavailable in this build."}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.centeredContent}>
            <Avatar uri={peerAvatar} name={peerName} size={74} />
            <Text style={[styles.peerName, { color: theme.colors.textPrimary }]}>{peerName}</Text>
            <Text style={[styles.peerMeta, { color: theme.colors.textMuted }]}>
              Audio call
            </Text>
          </View>
        )}
      </View>

      {showVideoLayout ? (
        <View style={[styles.localPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          {isWeb && localPreviewEnabled && localWebStream && canRenderWebVideo ? (
            <video autoPlay muted playsInline ref={localVideoRef} style={webVideoStyle} />
          ) : !isWeb && localPreviewEnabled && localStreamUrl && canRenderNativeRtcVideo && RtcView ? (
            <RtcView streamURL={localStreamUrl} mirror objectFit="cover" style={styles.rtcView} />
          ) : (
            <View style={styles.localPreviewPlaceholder}>
              <Feather
                name={isWeb ? (canRenderWebVideo ? "video-off" : "alert-triangle") : canRenderNativeRtcVideo ? "video-off" : "alert-triangle"}
                size={16}
                color={theme.colors.textMuted}
              />
              <Text style={[styles.localPreviewText, { color: theme.colors.textMuted }]}>
                {isWeb
                  ? canRenderWebVideo
                    ? "Camera off"
                    : "Renderer unavailable"
                  : canRenderNativeRtcVideo
                  ? "Camera off"
                  : "Renderer unavailable"}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10
  },
  remotePane: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 260,
    overflow: "hidden"
  },
  centeredContent: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    paddingHorizontal: 16
  },
  peerName: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12
  },
  peerMeta: {
    fontSize: 12,
    marginTop: 4
  },
  localPreview: {
    alignSelf: "flex-end",
    borderRadius: 12,
    borderWidth: 1,
    height: 112,
    width: 150,
    overflow: "hidden"
  },
  rtcView: {
    height: "100%",
    width: "100%"
  },
  localPreviewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%"
  },
  localPreviewText: {
    fontSize: 11,
    marginTop: 4
  }
});
