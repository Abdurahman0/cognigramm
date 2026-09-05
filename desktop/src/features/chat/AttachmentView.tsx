import { Download, FileText } from 'lucide-react'
import { useState } from 'react'

import { Dialog, DialogContent } from '@/components/ui'
import { formatBytes } from '@/api/adapters'
import { isDesktopRuntime } from '@/lib/tauri'
import type { Attachment } from '@/types'

const openExternally = async (url: string) => {
  if (isDesktopRuntime) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Renders one attachment by kind: image, audio, video note, or a file chip. */
export function AttachmentView({ attachment }: { attachment: Attachment }) {
  const [lightbox, setLightbox] = useState(false)
  const url = attachment.url

  if (!url) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-black/10 px-2.5 py-2 text-[13px]">
        <FileText className="size-4 shrink-0" />
        <span className="truncate">{attachment.name}</span>
      </div>
    )
  }

  if (attachment.mimeType.startsWith('image/')) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block overflow-hidden rounded-lg"
        >
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            className="max-h-72 max-w-full object-cover transition-transform duration-200 hover:scale-[1.01]"
          />
        </button>
        <Dialog open={lightbox} onOpenChange={setLightbox}>
          <DialogContent className="max-w-3xl bg-transparent p-2 shadow-none backdrop-blur-none">
            <img
              src={url}
              alt={attachment.name}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (attachment.mimeType.startsWith('audio/')) {
    return <audio controls src={url} className="h-9 w-64 max-w-full" preload="metadata" />
  }

  if (attachment.mimeType.startsWith('video/')) {
    return (
      <video
        controls
        src={url}
        preload="metadata"
        className="max-h-72 max-w-full rounded-xl object-cover"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => void openExternally(url)}
      className="flex w-full items-center gap-2.5 rounded-lg bg-black/10 px-2.5 py-2 text-left transition-colors hover:bg-black/20"
    >
      <FileText className="size-5 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{attachment.name}</span>
        <span className="block text-[11px] opacity-70">{formatBytes(attachment.sizeBytes)}</span>
      </span>
      <Download className="size-4 shrink-0 opacity-70" />
    </button>
  )
}
