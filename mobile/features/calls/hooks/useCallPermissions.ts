import { useCallback } from "react";
import { PermissionsAndroid, Platform } from "react-native";

import type { CallType, MediaPermissionResult } from "@/features/calls/types";
import { callLogger } from "@/features/calls/utils/callLogger";

const grantedResult: MediaPermissionResult = {
  granted: true,
  microphoneGranted: true,
  cameraGranted: true,
  errorMessage: ""
};

const deniedResult = (
  microphoneGranted: boolean,
  cameraGranted: boolean,
  errorMessage: string
): MediaPermissionResult => ({
  granted: false,
  microphoneGranted,
  cameraGranted,
  errorMessage
});

export const useCallPermissions = () => {
  const requestForCallType = useCallback(async (callType: CallType): Promise<MediaPermissionResult> => {
    if (Platform.OS === "web") {
      return grantedResult;
    }

    if (Platform.OS === "ios") {
      /**
       * iOS permission prompts are usually triggered by media-device access (getUserMedia).
       * Keep this path permissive here and let the WebRTC adapter surface device-level denial.
       */
      return grantedResult;
    }

    if (Platform.OS !== "android") {
      return deniedResult(false, false, "Unsupported platform for call permissions.");
    }

    try {
      const permissionKeys =
        callType === "video"
          ? [
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              PermissionsAndroid.PERMISSIONS.CAMERA
            ]
          : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

      const result = await PermissionsAndroid.requestMultiple(permissionKeys);
      const microphoneGranted =
        result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const cameraGranted =
        callType === "video"
          ? result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
          : true;

      if (!microphoneGranted || !cameraGranted) {
        return deniedResult(
          microphoneGranted,
          cameraGranted,
          callType === "video"
            ? "Microphone and camera permissions are required for video calls."
            : "Microphone permission is required for audio calls."
        );
      }

      return grantedResult;
    } catch (error) {
      callLogger.error("permissions.request failed", error);
      return deniedResult(false, callType !== "video", "Unable to request media permissions.");
    }
  }, []);

  return {
    requestForCallType
  };
};
