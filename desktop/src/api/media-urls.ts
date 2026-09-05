import { filesApi } from '@/api/endpoints'
import type { Attachment } from '@/types'

/**
 * Signed media URLs.
 *
 * S3 objects are private. What the API calls `public_url` is a signed GET URL
 * that expires in about 15 minutes, so it is a *lease*, never the identity of
 * a file — the identity is `bucket` + `object_key`. This module hands out a
 * currently-valid URL for an object and renews it when it runs out.
 */

/** Signed URLs last 900s; renew a little early rather than serve a dead one. */
const LEASE_MS = 840_000

interface Lease {
  url: string
  expiresAt: number
}

const leases = new Map<string, Lease>()
const inFlight = new Map<string, Promise<string | null>>()

const isFresh = (lease: Lease | undefined): lease is Lease =>
  Boolean(lease && lease.expiresAt > Date.now())

/**
 * Records the URL that came with a message, so opening a chat does not fire a
 * `/files/access` request per attachment for links that are already valid.
 */
export const rememberSignedUrl = (objectKey: string, url: string | null): void => {
  if (!objectKey || !url) return
  leases.set(objectKey, { url, expiresAt: Date.now() + LEASE_MS })
}

/** Drops a lease so the next request re-signs; used when a load actually fails. */
export const invalidateSignedUrl = (objectKey: string): void => {
  leases.delete(objectKey)
}

/**
 * A usable URL for one object, renewing through `/files/access` when needed.
 * Concurrent callers for the same key share one request.
 */
export async function resolveSignedUrl(objectKey: string): Promise<string | null> {
  if (!objectKey) return null

  const cached = leases.get(objectKey)
  if (isFresh(cached)) return cached.url

  const pending = inFlight.get(objectKey)
  if (pending) return pending

  const request = filesApi
    .access(objectKey)
    .then((response) => {
      const expiresIn = (response.expires_in ?? 900) * 1000
      leases.set(objectKey, { url: response.url, expiresAt: Date.now() + expiresIn * 0.93 })
      return response.url
    })
    .catch(() => {
      // 404 means the object is gone or no longer shared with this user; there
      // is nothing to retry, and the caller shows a broken-attachment state.
      return null
    })
    .finally(() => {
      inFlight.delete(objectKey)
    })

  inFlight.set(objectKey, request)
  return request
}

/** Seeds every lease carried by a freshly received message. */
export const rememberAttachmentUrls = (attachments: Attachment[]): void => {
  for (const attachment of attachments) {
    rememberSignedUrl(attachment.objectKey, attachment.signedUrl)
  }
}
