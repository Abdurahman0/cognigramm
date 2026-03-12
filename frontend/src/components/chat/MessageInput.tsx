"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  FaceSmileIcon,
  HandThumbUpIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon
} from "@heroicons/react/24/solid";
import { MicrophoneIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { AttachmentPreview } from "@/components/chat/AttachmentPreview";
import { sendMessageAction } from "@/features/messages/messageActions";
import { messagesApi } from "@/services/api";
import { useMessageStore } from "@/store/messageStore";
import type { Message, MessageType } from "@/types/message";
import { cn } from "@/utils/cn";
import { realtimeSocketClient } from "@/websocket/socketClient";

interface MessageInputProps {
  conversationId: number;
  editingMessage?: Message | null;
  onCancelEditing?: () => void;
}

export function MessageInput({ conversationId, editingMessage = null, onCancelEditing }: MessageInputProps): JSX.Element {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (!editingMessage) {
      setFiles([]);
      if (wasEditingRef.current) {
        setContent("");
      }
      wasEditingRef.current = false;
      return;
    }
    wasEditingRef.current = true;
    setFiles([]);
    setContent(editingMessage.content || "");
  }, [editingMessage]);

  const resolvedType = useMemo<MessageType>(() => {
    if (files.length === 0) {
      return "text";
    }
    const first = files[0];
    if (first.type.startsWith("image/")) {
      return "image";
    }
    if (first.type.startsWith("audio/")) {
      return "voice";
    }
    return "file";
  }, [files]);

  const canSend = Boolean(content.trim().length > 0 || files.length > 0) && !sending;
  const isEditing = Boolean(editingMessage);

  async function onSend(): Promise<void> {
    if (!canSend) {
      return;
    }
    const trimmedContent = content.trim();
    setSending(true);
    try {
      if (editingMessage) {
        if (!trimmedContent) {
          toast.error("Message cannot be empty");
          return;
        }
        const edited = await messagesApi.editMessage(editingMessage.id, trimmedContent);
        useMessageStore.getState().upsertMessage(conversationId, edited);
        realtimeSocketClient.send("edit_message", {
          message_id: editingMessage.id,
          content: trimmedContent
        });
        toast.success("Message edited");
        onCancelEditing?.();
        return;
      }

      await sendMessageAction({
        conversationId,
        content: trimmedContent || null,
        type: resolvedType,
        files
      });
      setContent("");
      setFiles([]);
      realtimeSocketClient.send("typing_stop", { conversation_id: conversationId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="border-t border-[var(--border)] px-3 py-2">
      {isEditing ? (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-[var(--primary)]/40 bg-[var(--messenger-active)] px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--primary)]">Editing message</p>
            <p className="truncate text-xs text-[var(--muted)]">{editingMessage?.content || "Attachment message"}</p>
          </div>
          <button
            type="button"
            onClick={() => onCancelEditing?.()}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--secondary)]"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <AttachmentPreview files={files} onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))} />

      <div className="flex items-center gap-2">
        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-[var(--secondary)]">
          <PlusIcon className="h-5 w-5 text-[var(--primary)]" />
          <input
            type="file"
            multiple
            disabled={isEditing}
            className="hidden"
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              if (!selected.length) {
                return;
              }
              setFiles((prev) => [...prev, ...selected]);
            }}
          />
        </label>

        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-[var(--secondary)]">
          <PhotoIcon className="h-5 w-5 text-[var(--primary)]" />
          <input
            type="file"
            multiple
            accept="image/*"
            disabled={isEditing}
            className="hidden"
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              if (!selected.length) {
                return;
              }
              setFiles((prev) => [...prev, ...selected]);
            }}
          />
        </label>

        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--secondary)]">
          <MicrophoneIcon className="h-5 w-5 text-[var(--primary)]" />
        </button>

        <div className="flex flex-1 items-center rounded-full bg-[var(--secondary)] px-3 py-1.5">
          <input
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (isEditing) {
                return;
              }
              if (event.target.value.trim().length > 0) {
                realtimeSocketClient.send("typing_start", { conversation_id: conversationId });
              } else {
                realtimeSocketClient.send("typing_stop", { conversation_id: conversationId });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSend().catch(() => undefined);
              }
            }}
            placeholder={isEditing ? "Change message..." : "Aa"}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
          <button className="ml-1 flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/70 dark:hover:bg-black/20">
            <FaceSmileIcon className="h-5 w-5 text-[var(--muted)]" />
          </button>
        </div>

        {canSend ? (
          <button
            type="button"
            onClick={() => onSend().catch(() => undefined)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              isEditing ? "bg-emerald-500 text-white hover:bg-emerald-600" : "hover:bg-[var(--secondary)]"
            )}
          >
            {isEditing ? <CheckIcon className="h-5 w-5" /> : <PaperAirplaneIcon className="h-5 w-5 text-[var(--primary)]" />}
          </button>
        ) : (
          <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--secondary)]">
            <HandThumbUpIcon className="h-5 w-5 text-[var(--primary)]" />
          </button>
        )}
      </div>
    </section>
  );
}
