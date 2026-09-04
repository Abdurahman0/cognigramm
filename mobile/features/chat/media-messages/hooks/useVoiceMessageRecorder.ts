import { useCallback, useMemo, useRef, useState } from "react";

import { createVoiceMetadata } from "@/features/chat/media-messages/services/mediaMetadata";
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/features/chat/media-messages/services/mediaRecorder";
import { createPreparedMediaDraft } from "@/features/chat/media-messages/services/sendMediaMessage";
import type { PreparedMediaDraft, RecorderState, RecordedVoiceMessage } from "@/features/chat/media-messages/types";

const initialState: RecorderState<RecordedVoiceMessage> = {
  step: "idle",
};

const normalizeRecorderError = (error: unknown): string => {
  if (error && typeof error === "object") {
    const name = typeof (error as { name?: unknown }).name === "string" ? (error as { name: string }).name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Microphone permission denied.";
    }
    if (name === "NotFoundError") {
      return "No microphone was found on this device.";
    }
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("support")) {
      return "Voice recording is not supported in this browser.";
    }
    return error.message;
  }
  return "Unable to record voice message.";
};

const safeRevokePreviewUrl = (draft: PreparedMediaDraft | null): void => {
  if (typeof URL === "undefined" || !draft?.previewUrl.startsWith("blob:")) {
    return;
  }
  URL.revokeObjectURL(draft.previewUrl);
};

export const useVoiceMessageRecorder = () => {
  const [state, setState] = useState<RecorderState<RecordedVoiceMessage>>(initialState);
  const [draft, setDraft] = useState<PreparedMediaDraft | null>(null);
  /**
   * Opening the device is async, so a hold can end before it finishes. Each start takes
   * a ticket; cancelling bumps the counter, and a start that finds its ticket stale
   * releases the device instead of announcing itself as recording.
   */
  const startTicket = useRef(0);

  const clearDraft = useCallback(() => {
    setDraft((current) => {
      safeRevokePreviewUrl(current);
      return null;
    });
  }, []);

  const start = useCallback(async () => {
    const ticket = (startTicket.current += 1);
    try {
      clearDraft();
      setState({ step: "requesting_permission" });
      await startVoiceRecording();
      if (startTicket.current !== ticket) {
        // The gesture ended while the microphone was still opening.
        await cancelVoiceRecording().catch(() => undefined);
        return;
      }
      setState({ step: "recording" });
    } catch (error) {
      setState({
        step: "error",
        errorMessage: normalizeRecorderError(error),
      });
    }
  }, [clearDraft]);

  const stop = useCallback(async () => {
    try {
      setState((current) => ({
        ...current,
        step: "stopping",
      }));
      const recorded = await stopVoiceRecording();
      const metadata = await createVoiceMetadata(recorded);
      setDraft(createPreparedMediaDraft("voice", recorded, metadata));
      setState({
        step: "ready",
        recorded,
      });
    } catch (error) {
      setState({
        step: "error",
        errorMessage: normalizeRecorderError(error),
      });
    }
  }, []);

  const cancel = useCallback(async () => {
    startTicket.current += 1;
    try {
      await cancelVoiceRecording();
    } finally {
      clearDraft();
      setState(initialState);
    }
  }, [clearDraft]);

  const reset = useCallback(() => {
    clearDraft();
    setState(initialState);
  }, [clearDraft]);

  return useMemo(
    () => ({
      state,
      draft,
      isRecording: state.step === "recording",
      isBusy: state.step === "requesting_permission" || state.step === "stopping",
      start,
      stop,
      cancel,
      reset,
    }),
    [cancel, draft, reset, start, state, stop],
  );
};
