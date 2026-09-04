import { Platform } from "react-native";

import * as nativeRecorder from "@/features/chat/media-messages/services/mediaRecorder.native";
import * as webRecorder from "@/features/chat/media-messages/services/mediaRecorder.web";

const recorder = Platform.OS === "web" ? webRecorder : nativeRecorder;

export const startVoiceRecording = recorder.startVoiceRecording;
export const stopVoiceRecording = recorder.stopVoiceRecording;
export const cancelVoiceRecording = recorder.cancelVoiceRecording;

export const startVideoNoteRecording = recorder.startVideoNoteRecording;
export const stopVideoNoteRecording = recorder.stopVideoNoteRecording;
export const cancelVideoNoteRecording = recorder.cancelVideoNoteRecording;

export const getVideoNotePreviewStream = recorder.getVideoNotePreviewStream;
export const pauseRecording = recorder.pauseRecording;
export const resumeRecording = recorder.resumeRecording;
export const supportsTorch = recorder.supportsTorch;
export const setTorch = recorder.setTorch;
export const canSwitchCamera = recorder.canSwitchCamera;
export const switchVideoNoteCamera = recorder.switchVideoNoteCamera;
export const getFacingMode = recorder.getFacingMode;
