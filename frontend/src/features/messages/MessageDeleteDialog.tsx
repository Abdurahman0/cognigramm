"use client";

import { toast } from "sonner";

import { useMessages } from "@/hooks/useMessages";
import type { Message } from "@/types/message";
import { realtimeSocketClient } from "@/websocket/socketClient";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

interface MessageDeleteDialogProps {
  message: Message | null;
  onClose: () => void;
}

export function MessageDeleteDialog({ message, onClose }: MessageDeleteDialogProps): JSX.Element | null {
  const { deleteMessage } = useMessages(message?.conversation_id || null);

  if (!message) {
    return null;
  }
  const currentMessage = message;

  async function handleDelete(): Promise<void> {
    try {
      await deleteMessage(currentMessage.id);

      realtimeSocketClient.send("delete_message", {
        message_id: currentMessage.id
      });

      toast.success("Message deleted");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete message");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Delete Message
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
          </div>
        </div>

        {currentMessage.content && (
          <div className="mt-4 rounded-lg border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {currentMessage.content}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium",
              "text-slate-700 hover:bg-slate-50",
              "dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
              "transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className={cn(
              "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white",
              "hover:bg-red-700",
              "transition-colors"
            )}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
