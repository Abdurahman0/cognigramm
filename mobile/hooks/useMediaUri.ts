import { useCallback, useEffect, useRef, useState } from 'react'

import {
	invalidateSignedUrl,
	rememberSignedUrl,
	resolveSignedUrl,
} from '@/services/api/mediaUrls'
import type { FileAttachment } from '@/types'

interface MediaUriState {
	uri: string | undefined
	/** The object is unreachable — deleted, or no longer shared with this user. */
	isUnavailable: boolean
	/** Call from a player's error handler: re-signs once and swaps the source. */
	retry: () => void
}

/**
 * A currently-valid URI for one attachment.
 *
 * The URI is deliberately sticky: every signing produces a different query
 * string for the same object, and the same message arrives more than once —
 * optimistically, then as the server's echo, then from a history reload. If
 * each of those swapped the source, a playing voice message would restart.
 * A URI is replaced only when there is none, when the attachment changes, or
 * when the player reports that the current one stopped working.
 */
export function useMediaUri(attachment?: FileAttachment | null): MediaUriState {
	const objectKey = attachment?.objectKey ?? null
	const initial = attachment?.uri ?? attachment?.publicUrl ?? undefined
	const [uri, setUri] = useState<string | undefined>(initial)
	const [isUnavailable, setIsUnavailable] = useState(false)
	const boundKeyRef = useRef<string | null>(initial ? objectKey : null)
	const retriedRef = useRef(false)

	useEffect(() => {
		if (initial) {
			rememberSignedUrl(objectKey, initial)
		}

		if (boundKeyRef.current === objectKey && uri) {
			return
		}

		retriedRef.current = false
		setIsUnavailable(false)

		if (initial) {
			boundKeyRef.current = objectKey
			setUri(initial)
			return
		}

		if (!objectKey) {
			setUri(undefined)
			return
		}

		let cancelled = false
		void resolveSignedUrl(objectKey).then(resolved => {
			if (cancelled) {
				return
			}
			boundKeyRef.current = resolved ? objectKey : null
			setUri(resolved ?? undefined)
			setIsUnavailable(resolved === null)
		})

		return () => {
			cancelled = true
		}
	}, [objectKey, initial, uri])

	const retry = useCallback(() => {
		if (retriedRef.current || !objectKey) {
			setIsUnavailable(true)
			return
		}
		retriedRef.current = true
		invalidateSignedUrl(objectKey)
		void resolveSignedUrl(objectKey).then(resolved => {
			boundKeyRef.current = resolved ? objectKey : null
			setUri(resolved ?? undefined)
			setIsUnavailable(resolved === null)
		})
	}, [objectKey])

	return { uri, isUnavailable, retry }
}
