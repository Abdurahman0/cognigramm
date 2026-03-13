"use client";

import { CheckCircleIcon, CheckIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { MessageAttachmentList } from "@/components/chat/AttachmentPreview";
import { MessageActions } from "@/components/chat/MessageActions";
import type { Message } from "@/types/message";
import { formatMessageTime } from "@/utils/date";

/* Deterministic avatar color */
const COLORS: [string, string][] = [
  ["#3b82f6", "#1d4ed8"],
  ["#8b5cf6", "#6d28d9"],
  ["#ec4899", "#be185d"],
  ["#f97316", "#c2410c"],
  ["#10b981", "#065f46"],
  ["#f59e0b", "#b45309"],
];
function grad(id: number): string {
  const [a, b] = COLORS[id % COLORS.length] ?? COLORS[0]!;
  return `linear-gradient(135deg, ${a}, ${b})`;
}

/* Delivery status icon (only shown for own messages) */
function DeliveryDot({ msg }: { msg: Message }) {
  if (msg.local_state === "pending" || msg.delivery_state === "queued")
    return <ClockIcon className="h-3 w-3 opacity-60" />;
  if (msg.local_state === "failed" || msg.delivery_state === "failed")
    return <ExclamationTriangleIcon className="h-3 w-3 text-red-300" />;
  if (msg.delivery_state === "read")
    return <CheckCircleIcon className="h-3 w-3" style={{ color: "#31a24c" }} />;
  if (msg.delivery_state === "delivered")
    return <CheckCircleIcon className="h-3 w-3 opacity-60" />;
  return <CheckIcon className="h-3 w-3 opacity-50" />;
}

interface Props {
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
  onDelete,
}: Props): JSX.Element {
  const canManage = isOwn && !message.deleted_at && Boolean(onEdit) && Boolean(onDelete);
  const senderId = message.sender_id ?? 0;

  return (
    <div
      className={`group flex items-end gap-1.5 px-3 py-[2px] ${
        isOwn ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar (received only) */}
      {!isOwn && (
        <div
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full text-[11px] font-bold text-white"
          style={{ background: grad(senderId) }}
        >
          {(senderName || "?").charAt(0).toUpperCase()}
        </div>
      )}

      {/* Actions visible on hover */}
      {canManage && (
        <div className="mb-1 self-end opacity-0 transition-opacity group-hover:opacity-100">
          <MessageActions isOwn onEdit={onEdit!} onDelete={onDelete!} />
        </div>
      )}

      {/* Bubble column */}
      <div className={`flex max-w-[65%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
        {/* Sender name (group chat, received) */}
        {!isOwn && showSenderName && senderName && (
          <p className="mb-0.5 ml-3 text-[12px] font-semibold" style={{ color: "var(--fg-secondary)" }}>
            {senderName}
          </p>
        )}

        {/* Bubble */}
        <div
          className="relative px-3 py-2 text-[15px] leading-snug"
          style={
            isOwn
              ? {
                  background: "var(--bubble-sent)",
                  color: "var(--bubble-sent-fg)",
                  borderRadius: "18px 18px 4px 18px",
                }
              : {
                  background: "var(--bubble-recv)",
                  color: "var(--bubble-recv-fg)",
                  borderRadius: "18px 18px 18px 4px",
                }
          }
        >
          {message.deleted_at ? (
            <p className="italic text-[13px] opacity-75">Message deleted</p>
          ) : message.content ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : null}
          <MessageAttachmentList attachments={message.attachments} />
        </div>

        {/* Timestamp + delivery — visible on hover */}
        <div
          className={`mt-0.5 flex items-center gap-1 px-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 ${
            isOwn ? "flex-row-reverse" : "flex-row"
          }`}
          style={{ color: "var(--fg-secondary)" }}
        >
          {message.edited_at && !message.deleted_at && <span>edited ·</span>}
          <span>{formatMessageTime(message.created_at)}</span>
          {isOwn && <DeliveryDot msg={message} />}
        </div>
      </div>
    </div>
  );
}
