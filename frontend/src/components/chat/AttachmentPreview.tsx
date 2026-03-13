"use client";

import type { MessageAttachment } from "@/types/message";

interface AttachmentPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function AttachmentPreview({ files, onRemove }: AttachmentPreviewProps): JSX.Element | null {
  if (files.length === 0) {
    return null;
  }
  return (
    <div className="mb-2 space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--secondary)] p-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center justify-between gap-2 rounded-xl bg-[var(--card)] px-3 py-2 text-[13px]"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--foreground)]">{file.name}</p>
            <p className="text-[var(--muted)]">{Math.ceil(file.size / 1024)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-600 hover:bg-red-100"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

export function MessageAttachmentList({ attachments }: { attachments: MessageAttachment[] }): JSX.Element | null {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map((attachment) => {
        const href = attachment.public_url || "#";
        const isImage = attachment.mime_type.startsWith("image/");
        if (isImage && attachment.public_url) {
          return (
            <a
              key={attachment.id}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl"
            >
              <img
                src={attachment.public_url}
                alt={attachment.original_name}
                className="max-h-72 w-full object-cover"
              />
            </a>
          );
        }
        return (
          <a
            key={attachment.id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[13px] hover:bg-white/20"
          >
            <p className="font-medium">📎 {attachment.original_name}</p>
            <p className="opacity-70">{Math.ceil(attachment.size_bytes / 1024)} KB</p>
          </a>
        );
      })}
    </div>
  );
}
