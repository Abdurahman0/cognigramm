"use client";

import { CheckCircleIcon, CheckIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { MessageAttachmentList } from "@/components/chat/AttachmentPreview";
import { MessageActions } from "@/components/chat/MessageActions";
import { cn } from "@/utils/cn";
import type { Message } from "@/types/message";
import { formatMessageTime } from "@/utils/date";

function deliveryLabel(message: Message): { text: string; icon: JSX.Element } {
  if (message.local_state === "pending" || message.delivery_state === "queued") {
    return { text: "Queued", icon: <ClockIcon className="h-3.5 w-3.5" /> };
  }
  if (message.local_state === "failed" || message.delivery_state === "failed") {
    return { text: "Failed", icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" /> };
  }
  if (message.delivery_state === "persisted") {
    return { text: "Persisted", icon: <CheckIcon className="h-3.5 w-3.5" /> };
  }
  if (message.delivery_state === "read") {
    return { text: "Read", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> };
  }
  if (message.delivery_state === "delivered") {
    return { text: "Delivered", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> };
  }
  return { text: "Sent", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> };
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
  const label = deliveryLabel(message);
  const canManageMessage = isOwn && !message.deleted_at && Boolean(onEdit) && Boolean(onDelete);

  return (
    <div className={cn("group flex items-start gap-1 px-3 py-1.5", isOwn ? "justify-end" : "justify-start")}>
      {canManageMessage ? (
        <div className="order-1 mt-1 self-start">
          <MessageActions isOwn={isOwn} onEdit={onEdit as () => void} onDelete={onDelete as () => void} />
        </div>
      ) : null}
      <article
        className={cn(
          "order-2 max-w-[70%] px-3 py-2 text-[15px] leading-snug shadow-sm",
          isOwn
            ? "rounded-[18px] rounded-br-[4px] bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "rounded-[18px] rounded-bl-[4px] bg-[var(--messenger-bubble-received)] text-[var(--foreground)]"
        )}
      >
        {!isOwn && showSenderName && senderName ? (
          <p className="mb-1 text-xs font-semibold opacity-80">{senderName}</p>
        ) : null}
        {message.deleted_at ? (
          <p className="italic opacity-70">Message deleted</p>
        ) : message.content ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : null}
        <MessageAttachmentList attachments={message.attachments} />
        <footer
          className={cn(
            "mt-1 flex items-center justify-end gap-2 text-[11px]",
            isOwn ? "text-white/80" : "text-[var(--muted)]"
          )}
        >
          {message.edited_at && !message.deleted_at ? <span>edited</span> : null}
          <span>{formatMessageTime(message.created_at)}</span>
          {isOwn ? (
            <span className="inline-flex items-center gap-1">
              {label.icon}
              {label.text}
            </span>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
