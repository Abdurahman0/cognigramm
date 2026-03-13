"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaceSmileIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon
} from "@heroicons/react/24/outline";
import { HandThumbUpIcon, PaperAirplaneIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    inputRef.current?.focus();
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
    <section className="border-t border-[var(--border)] px-3 py-2" style={{ background: "var(--messenger-header-bg)" }}>
      {/* Editing banner */}
      {isEditing ? (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-[#0084ff]/30 bg-[#e7f3ff] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#0084ff]">Editing message</p>
            <p className="truncate text-[12px] text-[var(--muted)]">{editingMessage?.content || "Attachment"}</p>
          </div>
          <button
            type="button"
            onClick={() => onCancelEditing?.()}
            className="rounded-full p-1 text-[var(--muted)] transition hover:bg-[var(--secondary)]"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <AttachmentPreview files={files} onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))} />

      <div className="flex items-center gap-1">
        {/* Left action buttons */}
        {!isEditing && (
          <>
            <label title="More options" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#0084ff] transition hover:bg-[var(--secondary)]">
              <PlusIcon className="h-[22px] w-[22px]" />
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  if (!selected.length) return;
                  setFiles((prev) => [...prev, ...selected]);
                }}
              />
            </label>
            <label title="Send photo or video" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#0084ff] transition hover:bg-[var(--secondary)]">
              <PhotoIcon className="h-[22px] w-[22px]" />
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  if (!selected.length) return;
                  setFiles((prev) => [...prev, ...selected]);
                }}
              />
            </label>
            <button title="Send voice message" className="flex h-9 w-9 items-center justify-center rounded-full text-[#0084ff] transition hover:bg-[var(--secondary)]">
              <MicrophoneIcon className="h-[22px] w-[22px]" />
            </button>
          </>
        )}

        {/* Text input */}
        <div className="relative flex flex-1 items-center rounded-full bg-[var(--secondary)] px-4 py-2">
          <input
            ref={inputRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (isEditing) return;
              if (event.target.value.trim().length > 0) {
                realtimeSocketClient.send("typing_start", { conversation_id: conversationId });
              } else {
                realtimeSocketClient.send("typing_stop", { conversation_id: conversationId });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend().catch(() => undefined);
              }
            }}
            placeholder={isEditing ? "Edit message..." : "Aa"}
            className="flex-1 bg-transparent text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="button"
            title="Insert emoji"
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <FaceSmileIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Right action button */}
        {canSend ? (
          isEditing ? (
            <button
              type="button"
              onClick={() => onSend().catch(() => undefined)}
              title="Save edit"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0084ff] text-white transition hover:bg-[#0073e6]"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSend().catch(() => undefined)}
              title="Send message"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#0084ff] transition hover:bg-[var(--secondary)]"
            >
              <PaperAirplaneIcon className="h-[22px] w-[22px]" />
            </button>
          )
        ) : (
          !isEditing && (
            <button
              type="button"
              title="Send like"
              onClick={() => {
                sendMessageAction({ conversationId, content: "👍", type: "text", files: [] }).catch(() => undefined);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#0084ff] transition hover:bg-[var(--secondary)]"
            >
              <HandThumbUpIcon className="h-[22px] w-[22px]" />
            </button>
          )
        )}
      </div>
    </section>
  );
}
