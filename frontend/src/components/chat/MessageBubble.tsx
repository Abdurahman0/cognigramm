"use client";

import { CheckCircleIcon, CheckIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { MessageAttachmentList } from "@/components/chat/AttachmentPreview";
import { MessageActions } from "@/components/chat/MessageActions";
import { cn } from "@/utils/cn";
import type { Message } from "@/types/message";
import { formatMessageTime } from "@/utils/date";

function DeliveryIcon({ message }: { message: Message }): JSX.Element | null {
  if (!message) return null;

  if (message.local_state === "pending" || message.delivery_state === "queued") {
    return <ClockIcon className="h-3.5 w-3.5 opacity-70" />;
  }
  if (message.local_state === "failed" || message.delivery_state === "failed") {
    return <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-300" />;
  }
  if (message.delivery_state === "read") {
    return (
      <span className="flex">
        <CheckCircleIcon className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (message.delivery_state === "delivered") {
    return <CheckCircleIcon className="h-3.5 w-3.5 opacity-70" />;
  }
  if (message.delivery_state === "persisted") {
    return <CheckIcon className="h-3.5 w-3.5 opacity-70" />;
  }
  return <CheckIcon className="h-3.5 w-3.5 opacity-50" />;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSenderName?: boolean;
  senderName?: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageBubble({
  message,
  isOwn,
  showSenderName = false,
  senderName,
  onEdit,
  onDelete
}: MessageBubbleProps): JSX.Element {
  const canManageMessage = isOwn && !message.deleted_at && Boolean(onEdit) && Boolean(onDelete);
  const avatarLetter = (senderName || "U").charAt(0).toUpperCase();

  return (
    <div className={cn("group flex items-end gap-1.5 px-4 py-0.5", isOwn ? "flex-row-reverse" : "flex-row")}>
      {/* Received avatar */}
      {!isOwn && (
        <div className="mb-0.5 h-7 w-7 shrink-0 self-end">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#60a5fa] to-[#3b82f6] text-[11px] font-bold text-white">
            {avatarLetter}
          </div>
        </div>
      )}

      {/* Actions (own messages) */}
      {canManageMessage ? (
        <div className="mb-1 opacity-0 transition-opacity group-hover:opacity-100">
          <MessageActions isOwn={isOwn} onEdit={onEdit as () => void} onDelete={onDelete as () => void} />
        </div>
      ) : null}

      {/* Bubble */}
      <div className={cn("flex max-w-[65%] flex-col", isOwn ? "items-end" : "items-start")}>
        {!isOwn && showSenderName && senderName ? (
          <p className="mb-1 ml-3 text-[12px] font-semibold text-[var(--muted)]">{senderName}</p>
        ) : null}

        <article
          className={cn(
            "relative px-3 py-2 text-[15px] leading-snug",
            isOwn
              ? "rounded-[18px] rounded-br-[4px] bg-[#0084ff] text-white"
              : "rounded-[18px] rounded-bl-[4px] bg-[var(--messenger-bubble-received)] text-[var(--foreground)]",
            message.deleted_at && "opacity-70"
          )}
        >
          {message.deleted_at ? (
            <p className="italic text-[13px] opacity-80">Message deleted</p>
          ) : message.content ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
          ) : null}
          <MessageAttachmentList attachments={message.attachments} />
        </article>

        {/* Timestamp + delivery */}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 px-1 text-[11px] text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          {message.edited_at && !message.deleted_at ? <span>edited ·</span> : null}
          <span>{formatMessageTime(message.created_at)}</span>
          {isOwn ? <DeliveryIcon message={message} /> : null}
        </div>
      </div>
    </div>
  );
}
