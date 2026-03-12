"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMessages } from "@/hooks/useMessages";
import type { Message } from "@/types/message";
import { realtimeSocketClient } from "@/websocket/socketClient";
import { cn } from "@/utils/cn";

interface MessageEditDialogProps {
  message: Message | null;
  onClose: () => void;
}

export function MessageEditDialog({ message, onClose }: MessageEditDialogProps): JSX.Element | null {
  const [content, setContent] = useState(message?.content || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { editMessage } = useMessages(message?.conversation_id || null);

  if (!message) {
    return null;
  }
  const currentMessage = message;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = content.trim();

    if (!trimmed) {
      toast.error("Message cannot be empty");
      return;
    }

    if (trimmed === currentMessage.content) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await editMessage(currentMessage.id, trimmed);

      realtimeSocketClient.send("edit_message", {
        message_id: currentMessage.id,
        content: trimmed
      });

      toast.success("Message updated");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to edit message");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Message</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Make changes to your message below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Type your message..."
            className={cn(
              "w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3",
              "text-sm text-slate-900 placeholder:text-slate-400",
              "outline-none ring-accent-400 focus:ring-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            )}
            disabled={isSubmitting}
            autoFocus
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium",
                "text-slate-700 hover:bg-slate-50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className={cn(
                "rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white",
                "hover:bg-accent-700",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "transition-colors"
              )}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
