"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaceSmileIcon,
  PhotoIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HandThumbUpIcon, PaperAirplaneIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";

import { AttachmentPreview } from "@/components/chat/AttachmentPreview";
import { sendMessageAction } from "@/features/messages/messageActions";
import { messagesApi } from "@/services/api";
import { useMessageStore } from "@/store/messageStore";
import type { Message, MessageType } from "@/types/message";
import { realtimeSocketClient } from "@/websocket/socketClient";

interface Props {
  conversationId: number;
  editingMessage?: Message | null;
  onCancelEditing?: () => void;
}

export function MessageInput({ conversationId, editingMessage = null, onCancelEditing }: Props): JSX.Element {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (!editingMessage) {
      setFiles([]);
      if (wasEditing.current) setContent("");
      wasEditing.current = false;
      return;
    }
    wasEditing.current = true;
    setFiles([]);
    setContent(editingMessage.content || "");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [editingMessage]);

  const type = useMemo<MessageType>(() => {
    if (!files.length) return "text";
    const f = files[0]!;
    if (f.type.startsWith("image/")) return "image";
    if (f.type.startsWith("audio/")) return "voice";
    return "file";
  }, [files]);

  const hasText = content.trim().length > 0;
  const canSend = (hasText || files.length > 0) && !sending;
  const isEditing = Boolean(editingMessage);

  async function send(): Promise<void> {
    if (!canSend) return;
    const trimmed = content.trim();
    setSending(true);
    try {
      if (editingMessage) {
        if (!trimmed) { toast.error("Message cannot be empty"); return; }
        const edited = await messagesApi.editMessage(editingMessage.id, trimmed);
        useMessageStore.getState().upsertMessage(conversationId, edited);
        realtimeSocketClient.send("edit_message", { message_id: editingMessage.id, content: trimmed });
        onCancelEditing?.();
        return;
      }
      await sendMessageAction({ conversationId, content: trimmed || null, type, files });
      setContent("");
      setFiles([]);
      realtimeSocketClient.send("typing_stop", { conversation_id: conversationId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send().catch(() => undefined); }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setContent(e.target.value);
    if (isEditing) return;
    if (e.target.value.trim()) {
      realtimeSocketClient.send("typing_start", { conversation_id: conversationId });
    } else {
      realtimeSocketClient.send("typing_stop", { conversation_id: conversationId });
    }
  }

  function addFiles(f: FileList | null) {
    if (!f) return;
    setFiles((prev) => [...prev, ...Array.from(f)]);
  }

  return (
    <section
      className="shrink-0 border-t px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--messenger-header-bg)" }}
    >
      {/* Editing banner */}
      {isEditing && (
        <div
          className="mb-2 flex items-start justify-between gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: "var(--blue)", background: "var(--surface-active)" }}
        >
          <div className="min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: "var(--blue)" }}>Editing message</p>
            <p className="truncate text-[12px]" style={{ color: "var(--fg-secondary)" }}>
              {editingMessage?.content || "Attachment"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCancelEditing?.()}
            className="rounded-full p-1 transition"
            style={{ color: "var(--fg-secondary)" }}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File previews */}
      <AttachmentPreview
        files={files}
        onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
      />

      {/* Input row */}
      <div className="flex items-center gap-1">
        {/* Left icons */}
        {!isEditing && (
          <>
            <FileBtn accept="*" multiple onFiles={addFiles} title="Attach file">
              <PlusCircleIcon className="h-[26px] w-[26px]" />
            </FileBtn>
            <FileBtn accept="image/*,video/*" multiple onFiles={addFiles} title="Photo / Video">
              <PhotoIcon className="h-[26px] w-[26px]" />
            </FileBtn>
            <ActionBtn title="Voice message">
              <MicrophoneIcon className="h-[26px] w-[26px]" />
            </ActionBtn>
          </>
        )}

        {/* Text input */}
        <div
          className="relative flex flex-1 items-center rounded-full px-4 py-[8px]"
          style={{ background: "var(--surface)" }}
        >
          <input
            ref={inputRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isEditing ? "Edit message…" : "Aa"}
            className="flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: "var(--fg)" }}
          />
          <button
            type="button"
            title="Emoji"
            className="ml-1 shrink-0 transition opacity-70 hover:opacity-100"
            style={{ color: "var(--fg-secondary)" }}
          >
            <FaceSmileIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Right button */}
        {canSend ? (
          <ActionBtn
            title={isEditing ? "Save edit" : "Send message"}
            onClick={() => send().catch(() => undefined)}
            primary
          >
            <PaperAirplaneIcon className="h-[22px] w-[22px]" />
          </ActionBtn>
        ) : !isEditing ? (
          <ActionBtn
            title="Like"
            onClick={() =>
              sendMessageAction({ conversationId, content: "👍", type: "text", files: [] }).catch(() => undefined)
            }
          >
            <HandThumbUpIcon className="h-[22px] w-[22px]" />
          </ActionBtn>
        ) : null}
      </div>
    </section>
  );
}

/* Tiny helper components */
function ActionBtn({
  children,
  onClick,
  title,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
      style={
        primary
          ? { background: "var(--blue)", color: "#fff" }
          : { color: "var(--blue)" }
      }
      onMouseEnter={(e) => {
        if (!primary) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)";
      }}
      onMouseLeave={(e) => {
        if (!primary) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function FileBtn({
  children,
  accept,
  multiple,
  onFiles,
  title,
}: {
  children: React.ReactNode;
  accept: string;
  multiple?: boolean;
  onFiles: (f: FileList | null) => void;
  title?: string;
}) {
  return (
    <label
      title={title}
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition"
      style={{ color: "var(--blue)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "var(--surface)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLLabelElement).style.background = "transparent")}
    >
      {children}
      <input type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => onFiles(e.target.files)} />
    </label>
  );
}
