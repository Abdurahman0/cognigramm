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
    <div className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/70">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs dark:bg-slate-800">
          <div className="min-w-0">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-slate-500 dark:text-slate-400">{Math.ceil(file.size / 1024)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-md bg-red-50 px-2 py-1 text-red-600 dark:bg-red-900/20 dark:text-red-300"
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
    <div className="mt-2 space-y-2">
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
              className="block overflow-hidden rounded-lg border border-slate-300/50 dark:border-slate-600/50"
            >
              <img src={attachment.public_url} alt={attachment.original_name} className="max-h-72 w-full object-cover" />
            </a>
          );
        }
        return (
          <a
            key={attachment.id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-slate-300/50 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600/50 dark:bg-slate-900/60"
          >
            <p className="font-medium">{attachment.original_name}</p>
            <p className="text-slate-500 dark:text-slate-400">{Math.ceil(attachment.size_bytes / 1024)} KB</p>
          </a>
        );
      })}
    </div>
  );
}
