import { FileText, ImageOff, Mic, Paperclip, Video } from 'lucide-react'
import { useMemo, useState } from 'react'

import { formatBytes } from '@/api/adapters'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { AttachmentView } from '@/features/chat/AttachmentView'
import { VoiceMessage } from '@/features/chat/VoiceMessage'
import { useMediaUrl } from '@/hooks/use-media-url'
import { useLoadOlderMessages, useMessages } from '@/hooks/use-messages'
import { formatListTime } from '@/lib/format'
import type { Attachment, Message } from '@/types'

type Bucket = 'media' | 'files' | 'voice'

interface SharedItem {
  attachment: Attachment
  message: Message
  bucket: Bucket
}

const bucketOf = (attachment: Attachment, message: Message): Bucket => {
  if (message.kind === 'voice' || attachment.mimeType.startsWith('audio/')) return 'voice'
  if (attachment.mimeType.startsWith('image/') || attachment.mimeType.startsWith('video/')) {
    return 'media'
  }
  return 'files'
}

/** A square thumbnail for the media grid; the row view is too tall for photos. */
export function SharedMediaThumb({
  attachment,
  onOpen,
}: {
  attachment: Attachment
  onOpen: () => void
}) {
  const { url, isResolving, isUnavailable, retry } = useMediaUrl(attachment)
  const isVideo = attachment.mimeType.startsWith('video/')

  if (isUnavailable) {
    return (
      <div className="bg-input text-faint-foreground grid aspect-square place-items-center rounded-lg">
        <ImageOff className="size-5" />
      </div>
    )
  }

  if (!url) return <Skeleton className="aspect-square rounded-lg" />

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden rounded-lg"
      aria-label={attachment.name}
    >
      {isVideo ? (
        <video src={url} onError={retry} className="size-full object-cover" preload="metadata" />
      ) : (
        <img
          src={url}
          alt={attachment.name}
          loading="lazy"
          onError={retry}
          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      )}
      {isResolving ? (
        <span className="absolute inset-0 grid place-items-center bg-black/30">
          <Spinner className="text-white" />
        </span>
      ) : null}
      {isVideo ? (
        <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/55 p-1">
          <Video className="size-3 text-white" />
        </span>
      ) : null}
    </button>
  )
}

function ItemRow({ item }: { item: SharedItem }) {
  return (
    <div className="raised-card flex items-center gap-3 rounded-xl px-3 py-2">
      <div className="min-w-0 flex-1">
        {/* A voice message keeps its waveform here too; the browser's default
            audio bar would be the only control in the app that looks foreign. */}
        {item.bucket === 'voice' ? (
          <VoiceMessage attachment={item.attachment} mine={false} />
        ) : (
          <AttachmentView attachment={item.attachment} />
        )}
        <p className="text-faint-foreground mt-1 text-[11px]">
          {item.message.senderName ?? 'Unknown'} · {formatListTime(item.message.createdAt)} ·{' '}
          {formatBytes(item.attachment.sizeBytes)}
        </p>
      </div>
    </div>
  )
}

interface SharedFilesDialogProps {
  conversationId: number
  open: boolean
  onClose: () => void
}

/**
 * Everything shared in one conversation.
 *
 * The list is built from the transcript the client has loaded, so "load
 * earlier" here means the same thing it means in the chat — it pulls another
 * page of history, and anything attached to it appears.
 */
export function SharedFilesDialog({ conversationId, open, onClose }: SharedFilesDialogProps) {
  const { data: messages, isPending } = useMessages(open ? conversationId : null)
  const { loadOlder, isLoading, hasMore } = useLoadOlderMessages(conversationId)
  const [preview, setPreview] = useState<SharedItem | null>(null)

  const items = useMemo<SharedItem[]>(() => {
    const rows: SharedItem[] = []
    for (const message of messages ?? []) {
      if (message.isDeleted) continue
      for (const attachment of message.attachments) {
        rows.push({ attachment, message, bucket: bucketOf(attachment, message) })
      }
    }
    // Newest first: the thing you shared a minute ago is what you are looking for.
    return rows.reverse()
  }, [messages])

  const media = items.filter((item) => item.bucket === 'media')
  const files = items.filter((item) => item.bucket === 'files')
  const voice = items.filter((item) => item.bucket === 'voice')

  const empty = (label: string) => (
    <p className="text-muted-foreground grid h-40 place-items-center text-[13px]">{label}</p>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shared files</DialogTitle>
            <DialogDescription>
              {items.length} item{items.length === 1 ? '' : 's'} in the loaded history
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="media">
            <TabsList className="w-full">
              <TabsTrigger value="media">
                <Paperclip className="size-3.5" /> Media ({media.length})
              </TabsTrigger>
              <TabsTrigger value="files">
                <FileText className="size-3.5" /> Files ({files.length})
              </TabsTrigger>
              <TabsTrigger value="voice">
                <Mic className="size-3.5" /> Voice ({voice.length})
              </TabsTrigger>
            </TabsList>

            <div className="mt-3 max-h-[55vh] min-h-52 overflow-y-auto pr-1">
              {isPending ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <TabsContent value="media">
                    {media.length === 0 ? (
                      empty('No photos or videos yet.')
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {media.map((item) => (
                          <SharedMediaThumb
                            key={item.attachment.objectKey || item.attachment.id}
                            attachment={item.attachment}
                            onOpen={() => setPreview(item)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="files">
                    {files.length === 0 ? (
                      empty('No documents yet.')
                    ) : (
                      <div className="space-y-1.5">
                        {files.map((item) => (
                          <ItemRow
                            key={item.attachment.objectKey || item.attachment.id}
                            item={item}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="voice">
                    {voice.length === 0 ? (
                      empty('No voice messages yet.')
                    ) : (
                      <div className="space-y-1.5">
                        {voice.map((item) => (
                          <ItemRow
                            key={item.attachment.objectKey || item.attachment.id}
                            item={item}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>

          {hasMore ? (
            <Button variant="secondary" disabled={isLoading} onClick={() => void loadOlder()}>
              {isLoading ? <Spinner /> : null}
              Load earlier messages
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="max-w-3xl bg-transparent p-2 shadow-none backdrop-blur-none">
          {preview ? <AttachmentView attachment={preview.attachment} /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
