import { useCallback, useMemo, useState } from "react";

import { createVideoNoteMetadata } from "@/features/chat/media-messages/services/mediaMetadata";
import {
  cancelVideoNoteRecording,
  startVideoNoteRecording,
  stopVideoNoteRecording,
} from "@/features/chat/media-messages/services/mediaRecorder";
import { createPreparedMediaDraft } from "@/features/chat/media-messages/services/sendMediaMessage";
import type { PreparedMediaDraft, RecordedVideoNoteMessage, RecorderState } from "@/features/chat/media-messages/types";

const initialState: RecorderState<RecordedVideoNoteMessage> = {
  step: "idle",
};

const normalizeRecorderError = (error: unknown): string => {
  if (error && typeof error === "object") {
    const name = typeof (error as { name?: unknown }).name === "string" ? (error as { name: string }).name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Camera or microphone permission denied.";
    }
    if (name === "NotFoundError") {
      return "No camera was found on this device.";
    }
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("support")) {
      return "Video note recording is not supported in this browser.";
    }
    return error.message;
  }
  return "Unable to record video note.";
};

const isCanceledError = (message?: string): boolean =>
  typeof message === "string" && message.toLowerCase().includes("canceled");

const safeRevokePreviewUrl = (draft: PreparedMediaDraft | null): void => {
  if (typeof URL === "undefined" || !draft?.previewUrl.startsWith("blob:")) {
    return;
  }
  URL.revokeObjectURL(draft.previewUrl);
};

export const useVideoNoteRecorder = () => {
  const [state, setState] = useState<RecorderState<RecordedVideoNoteMessage>>(initialState);
  const [draft, setDraft] = useState<PreparedMediaDraft | null>(null);
  const [awaitingStop, setAwaitingStop] = useState(false);

  const clearDraft = useCallback(() => {
    setDraft((current) => {
      safeRevokePreviewUrl(current);
      return null;
    });
  }, []);

  const finalize = useCallback(async (recorded: RecordedVideoNoteMessage) => {
    const metadata = await createVideoNoteMetadata(recorded);
    setDraft(createPreparedMediaDraft("video_note", recorded, metadata));
    setState({
      step: "ready",
      recorded,
    });
  }, []);

  const start = useCallback(async () => {
    try {
      clearDraft();
      setState({ step: "requesting_permission" });
      const startResult = await startVideoNoteRecording();
      if (startResult.requiresStop) {
        setAwaitingStop(true);
        setState({ step: "recording" });
        return;
      }
      if (startResult.recorded) {
        setAwaitingStop(false);
        await finalize(startResult.recorded);
        return;
      }
      setState(initialState);
    } catch (error) {
      const message = normalizeRecorderError(error);
      if (isCanceledError(message)) {
        setAwaitingStop(false);
        setState(initialState);
        return;
      }
      setState({
        step: "error",
        errorMessage: message,
      });
    }
  }, [clearDraft, finalize]);

  const stop = useCallback(async () => {
    if (!awaitingStop) {
      return;
    }
    try {
      setState((current) => ({
        ...current,
        step: "stopping",
      }));
      const recorded = await stopVideoNoteRecording();
      setAwaitingStop(false);
      await finalize(recorded);
    } catch (error) {
      setAwaitingStop(false);
      setState({
        step: "error",
        errorMessage: normalizeRecorderError(error),
      });
    }
  }, [awaitingStop, finalize]);

  const cancel = useCallback(async () => {
    try {
      await cancelVideoNoteRecording();
    } finally {
      setAwaitingStop(false);
      clearDraft();
      setState(initialState);
    }
  }, [clearDraft]);

  const reset = useCallback(() => {
    setAwaitingStop(false);
    clearDraft();
    setState(initialState);
  }, [clearDraft]);

  return useMemo(
    () => ({
      state,
      draft,
      needsStopAction: awaitingStop,
      isRecording: state.step === "recording",
      isBusy: state.step === "requesting_permission" || state.step === "stopping",
      start,
      stop,
      cancel,
      reset,
    }),
    [awaitingStop, cancel, draft, reset, start, state, stop],
  );
};
