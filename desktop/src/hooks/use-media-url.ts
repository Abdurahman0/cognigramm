import { useCallback, useEffect, useRef, useState } from 'react'

import { invalidateSignedUrl, rememberSignedUrl, resolveSignedUrl } from '@/api/media-urls'
import type { Attachment } from '@/types'

interface MediaUrlState {
  url: string | null
  /** True until the first URL is known; only set when one must be fetched. */
  isResolving: boolean
  /** The object is unreachable — deleted, or no longer shared with this user. */
  isUnavailable: boolean
  /** Call from an element's `onError`: re-signs once and swaps the source. */
  retry: () => void
}

/**
 * A currently-valid URL for one attachment.
 *
 * The URL is deliberately *sticky*. Every signing produces a different query
 * string for the same object, and the same message can arrive more than once —
 * optimistically, then as the server's echo, then from a history refetch. If
 * each of those swapped the element's `src`, a playing voice message would
 * restart from zero every time. So a URL is replaced only when there is none
 * yet, when the attachment itself changes, or when the media element reports
 * that the current one stopped working.
 */
export function useMediaUrl(attachment: Attachment): MediaUrlState {
  const { objectKey, signedUrl } = attachment
  const [url, setUrl] = useState<string | null>(signedUrl)
  const [isResolving, setIsResolving] = useState(false)
  const [isUnavailable, setIsUnavailable] = useState(false)
  /** Which object the current URL belongs to. */
  const boundKeyRef = useRef<string | null>(signedUrl ? objectKey : null)
  // One automatic re-sign per attachment: if the fresh URL also fails, the
  // object itself is the problem and retrying would spin.
  const retriedRef = useRef(false)

  useEffect(() => {
    // A newly signed URL for the object already on screen is still worth
    // caching — it is fresher than the lease we hold — but not worth showing.
    if (signedUrl) rememberSignedUrl(objectKey, signedUrl)

    if (boundKeyRef.current === objectKey && url) return

    retriedRef.current = false
    setIsUnavailable(false)

    if (signedUrl) {
      boundKeyRef.current = objectKey
      setUrl(signedUrl)
      return
    }

    if (!objectKey) {
      setUrl(null)
      return
    }

    let cancelled = false
    setIsResolving(true)
    void resolveSignedUrl(objectKey).then((resolved) => {
      if (cancelled) return
      boundKeyRef.current = resolved ? objectKey : null
      setUrl(resolved)
      setIsUnavailable(resolved === null)
      setIsResolving(false)
    })

    return () => {
      cancelled = true
    }
  }, [objectKey, signedUrl, url])

  const retry = useCallback(() => {
    if (retriedRef.current || !objectKey) {
      setIsUnavailable(true)
      return
    }
    retriedRef.current = true
    invalidateSignedUrl(objectKey)
    setIsResolving(true)
    void resolveSignedUrl(objectKey).then((resolved) => {
      boundKeyRef.current = resolved ? objectKey : null
      setUrl(resolved)
      setIsUnavailable(resolved === null)
      setIsResolving(false)
    })
  }, [objectKey])

  return { url, isResolving, isUnavailable, retry }
}
