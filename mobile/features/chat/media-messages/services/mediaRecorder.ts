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
