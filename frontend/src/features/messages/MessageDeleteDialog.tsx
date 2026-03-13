"use client";

import { toast } from "sonner";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { useMessages } from "@/hooks/useMessages";
import type { Message } from "@/types/message";
import { realtimeSocketClient } from "@/websocket/socketClient";

interface MessageDeleteDialogProps {
  message: Message | null;
  onClose: () => void;
}

export function MessageDeleteDialog({ message, onClose }: MessageDeleteDialogProps): JSX.Element | null {
  const { deleteMessage } = useMessages(message?.conversation_id || null);

  if (!message) return null;

  const currentMessage = message;

  async function handleDelete(): Promise<void> {
    try {
      await deleteMessage(currentMessage.id);
      realtimeSocketClient.send("delete_message", { message_id: currentMessage.id });
      toast.success("Message deleted");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete message");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-[var(--card)] shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-4 py-4 text-center">
          <h3 className="text-[18px] font-bold text-[var(--foreground)]">Delete message?</h3>
          <p className="mt-1 text-[14px] text-[var(--muted)]">This can&apos;t be undone.</p>
        </div>

        {/* Message preview */}
        {currentMessage.content && (
          <div className="mx-4 mt-4 rounded-2xl bg-[var(--secondary)] px-4 py-3">
            <p className="text-[14px] text-[var(--foreground)] line-clamp-3">{currentMessage.content}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            onClick={handleDelete}
            className="w-full rounded-xl bg-red-500 py-2.5 text-[15px] font-semibold text-white transition hover:bg-red-600"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-[var(--border)] py-2.5 text-[15px] font-semibold text-[var(--foreground)] transition hover:bg-[var(--secondary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
