import { useCallback, useMemo, useState } from "react";

import { sendMediaMessage } from "@/features/chat/media-messages/services/sendMediaMessage";
import type { PreparedMediaDraft, SendState } from "@/features/chat/media-messages/types";
import type { MessageType } from "@/types";
import type { FileAttachment } from "@/types";

interface UseSendMediaMessageOptions {
  chatId: string;
  sendMessage: (payload: {
    chatId: string;
    body: string | null;
    type: MessageType;
    attachment?: FileAttachment;
    clientMessageId?: string;
  }) => Promise<void>;
}

interface SendDraftResult {
  ok: boolean;
  errorMessage?: string;
  clientMessageId?: string;
}

const initialSendState: SendState = {
  step: "idle",
};

const normalizeSendError = (error: unknown): string =>
  error instanceof Error ? error.message : "Unable to send media message.";

export const useSendMediaMessage = ({ chatId, sendMessage }: UseSendMediaMessageOptions) => {
  const [state, setState] = useState<SendState>(initialSendState);

  const sendDraft = useCallback(
    async (draft: PreparedMediaDraft): Promise<SendDraftResult> => {
      if (state.step === "sending") {
        return {
          ok: false,
          errorMessage: "A media message is already being sent.",
        };
      }
      setState({ step: "sending" });
      try {
        const clientMessageId = await sendMediaMessage(
          {
            chatId,
            draft,
          },
          sendMessage,
        );
        setState({
          step: "queued",
          clientMessageId,
        });
        return {
          ok: true,
          clientMessageId,
        };
      } catch (error) {
        const message = normalizeSendError(error);
        setState({
          step: "failed",
          errorMessage: message,
        });
        return {
          ok: false,
          errorMessage: message,
        };
      }
    },
    [chatId, sendMessage, state.step],
  );

  const reset = useCallback(() => {
    setState(initialSendState);
  }, []);

  return useMemo(
    () => ({
      state,
      isSending: state.step === "sending",
      sendDraft,
      reset,
    }),
    [reset, sendDraft, state],
  );
};
