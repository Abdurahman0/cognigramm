import { Platform } from "react-native";

import type {
  CreateWebRtcAdapterOptions,
  WebRtcAdapter
} from "@/features/calls/services/webrtcAdapter.types";

export const createWebRtcAdapter = (
  options: CreateWebRtcAdapterOptions = {}
): WebRtcAdapter => {
  if (Platform.OS === "web") {
    const webFactory = require("@/features/calls/services/webrtcAdapter.web") as {
      createWebRtcAdapter: (webOptions: CreateWebRtcAdapterOptions) => WebRtcAdapter;
    };
    return webFactory.createWebRtcAdapter(options);
  }

  const nativeFactory = require("@/features/calls/services/webrtcAdapter.native") as {
    createWebRtcAdapter: (nativeOptions: CreateWebRtcAdapterOptions) => WebRtcAdapter;
  };
  return nativeFactory.createWebRtcAdapter(options);
};

export * from "@/features/calls/services/webrtcAdapter.types";
