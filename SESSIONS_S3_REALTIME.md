# Sessions, S3 Storage and Realtime Integration

Production REST: `https://messanger.cognilabs.org`
Production WebSocket: `wss://messanger.cognilabs.org/ws/chat`
Swagger: `https://messanger.cognilabs.org/docs`

This guide supplements FRONTEND_INTEGRATION.md and supersedes its older authentication and ImageKit upload contracts. It applies to web and native mobile clients.

## Persistent Login

Access JWTs last 15 minutes. Each login creates a separate device session in PostgreSQL. Refresh tokens extend that session to 180 days from refresh. Server restarts do not log users out. Revocation, token reuse or 180 days without refresh ends a session. Existing pre-session tokens require one new login after this release. Do not increase the JWT lifetime to implement persistent login.

### Mobile Login

`POST /auth/login`

```json
{"identifier":"username-or-email","password":"user-password","device_name":"iPhone 16","client_type":"mobile"}
```

Response `200`:

```json
{"access_token":"<JWT>","refresh_token":"<opaque-secret>","token_type":"bearer","expires_in":900,"session_id":"<UUID>"}
```

Keep refresh tokens in iOS Keychain / Android Keystore-backed secure storage. Do not store passwords. Keep access tokens in memory; recover access after app startup by refreshing. Persist the new refresh token before releasing waiting requests.

### Web Login

Use the same body with `client_type: "web"` and `device_name` identifying the browser. Use `credentials: "include"` on login, refresh and logout. The browser Origin must be explicitly allowed by server CORS. Arbitrary origins are rejected.

Response has the same fields, but `refresh_token: null`. The refresh token is set in a Secure, HttpOnly, host-only cookie named `__Host-messenger-refresh`; JavaScript cannot read it. Access token stays in memory. Cookie SameSite defaults to Lax. A frontend on a different site needs a reviewed SameSite=None configuration; browsers may still block third-party cookies. Prefer a same-site frontend such as `app.cognilabs.org`.

### Refresh

`POST /auth/refresh`

Mobile body:

```json
{"refresh_token":"<current-refresh-token>"}
```

Web body: `{}`, with credentials included. Response matches login; mobile receives a replacement refresh token, web gets a replacement cookie.

There must be ONE refresh operation at a time per session, including across browser tabs. Use Web Locks/BroadcastChannel or an equivalent shared coordinator. Queue pending API requests, perform one refresh, then retry each protected request at most once. Reusing an old refresh token revokes that session. Never blindly retry a refresh after a lost response; strict rotation may require a new login in that case.

Refresh before expiry, or after a protected request returns `401`. Network errors, `429` and `5xx` must not clear login state. On app startup, refresh first, then load `/users/me` and open WebSocket. A definitive refresh `401` means show login. An Origin `403` is a configuration error, not a reason to loop refresh.

### Device Management

All endpoints below require `Authorization: Bearer <access_token>`.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/auth/sessions` | Active device sessions, newest activity first |
| DELETE | `/auth/sessions/{session_id}` | Revoke an owned device session; another user's ID returns 404 |
| POST | `/auth/logout` | Revoke current session and clear web refresh cookie |
| POST | `/auth/logout-all` | Revoke current active sessions for this user and clear cookie |

Mutation response: `{"status":"ok"}`.

Session list item:

```json
{"id":"<UUID>","device_name":"iPhone 16","created_at":"2026-09-05T12:00:00Z","last_used_at":"2026-09-05T12:20:00Z","expires_at":"2027-03-04T12:20:00Z","is_current":true}
```

`last_used_at` records refresh activity. A revoked access token immediately fails subsequent API requests. Open sockets check revocation on every incoming event and every 15 seconds of idle time, then close with code 4001. Previously issued S3 URLs remain valid until their separate expiry.

### WebSocket Reconnection

Connect using a current access token in `?token=...`. Optional presence `session_id` is not the authentication session ID and does not grant access. On reconnect refresh if needed, reconnect with exponential backoff and jitter, then recover changes. Never put a refresh token in a URL. Established sockets remain usable across access-token expiry while their device session remains valid.

## S3 Files

New uploads use bucket `cognilabs` at `https://fsn1.your-objectstorage.com`, signing region `fsn1`. All application-generated keys start with `u-message/{user_id}/{uuid}/`. The backend does not create files outside this prefix and does not change bucket-wide policy. Old ImageKit attachments remain readable at their existing URLs; this release does not copy historical media.

S3 objects are private. `public_url` is retained for compatibility but now means a temporary signed GET URL, normally valid for 900 seconds. Never persist it as the identity of a file. Persist `bucket` and `object_key`; obtain a fresh URL when needed. Signed URLs can be used in `<img>`, `<audio>`, `<video>` or native media players without sending the backend JWT to S3.

### Recommended Upload

`POST /files/upload`, bearer authentication, `multipart/form-data`, one binary field named `file`. `/files/upload-local` remains a deprecated alias with the same S3 behavior. Do not set multipart Content-Type manually; let the client generate the boundary.

Response `200`:

```json
{"bucket":"cognilabs","object_key":"u-message/12/9feec061-5446-447f-887d-7a0d82da25954/photo.png","original_name":"photo.png","mime_type":"image/png","size_bytes":20480,"public_url":"https://fsn1.your-objectstorage.com/cognilabs/u-message/...?...signature..."}
```

Size range is 1 byte to 100 MiB. Empty/oversized uploads return 413; provider failures return 502. Uploads are transferred using bounded S3 multipart buffers. The HTTP framework may spool incoming multipart data temporarily; it is closed after the request. There is no persistent local media directory.

Upload does not send a message. Send the returned attachment fields through the existing WebSocket `send_message` event:

```json
{"event":"send_message","payload":{"conversation_id":42,"client_message_id":"<unique-UUID>","type":"image","attachments":[{"bucket":"cognilabs","object_key":"u-message/12/<UUID>/photo.png","original_name":"photo.png","mime_type":"image/png","size_bytes":20480}]}}
```

For voice use `type: "voice"`; for round video use `type: "video_note"`. Add client-generated `metadata_json` such as duration, waveform or dimensions. The upload response itself does not analyze media or generate these values. Playback shape is frontend presentation; backend does not crop video to a circle.

The backend checks ownership, bucket, prefix, actual S3 size and Content-Type before attaching a new upload. Forwarding an existing message is authorized using source conversation membership and copies the stored attachment metadata. Do not manually reuse another user's uploaded attachment.

### Refresh File Access

`GET /files/access?object_key=<URL-encoded-key>` with bearer authentication.

Response `200`: `{"url":"<signed-GET-URL>","expires_in":900}`.

Access is allowed to the uploader or a current member of a conversation with a non-deleted message referencing that file. Unauthorized keys return 404. History and realtime message responses also generate fresh signed URLs. On expired media URL, refresh once and update player/image source. Removing a group member blocks new URLs, but cannot revoke a signed URL already delivered until it expires.

### Optional Direct Upload

`POST /files/presign` with bearer token:

```json
{"filename":"recording.wav","content_type":"audio/wav","size_bytes":16044}
```

Response includes `upload_url`, `bucket`, `object_key`, `expires_in`, `content_type`, `size_bytes`, `public_url`. PUT raw bytes to `upload_url` with exactly the declared Content-Type and size. The signature includes Content-Length. Check the PUT response before sending a message. Native clients can use this directly. Browser direct PUT additionally requires bucket CORS for the actual frontend origin; this release does not overwrite shared bucket CORS. The recommended backend upload works without S3 PUT CORS.

## Realtime and Recovery

Existing WS names are preserved: `message_queued`, `message_persisted`, `message_persisted_ack`, `message_edited`, `message_deleted`, `message_pinned`, `message_unpinned`. A queued acknowledgement follows RabbitMQ acceptance; mark the UI as saved only after persisted acknowledgement. Retry uncertain sends using the SAME UUID. Consumers can redeliver events, so clients must deduplicate by message ID. A client_message_id collision belonging to a different user/conversation is rejected.

REST edit/delete now publish the same message events as WS edit/delete. Creating a conversation sends `conversation_created` to its members. Adding members sends `conversation_members_added` with the conversation payload and joins their active sockets. Removed members receive `conversation_removed` and stop receiving subsequent room broadcasts.

### Change Cursor

`GET /conversations/{id}/changes?after_id=0&limit=100`

```json
{"items":[{"cursor":123,"event":"message_edited","message":{"id":45,"conversation_id":42,"content":"updated"}}],"next_cursor":123,"has_more":false}
```

The example abbreviates `message`; actual values use the full message contract. Each item contains current message state, not a historical snapshot. Apply items as upserts by message ID. Deleted messages contain a tombstone with `deleted_at`, empty attachments and cleared pin state.

Persist `next_cursor` per conversation after applying the whole page. Fetch pages until `has_more: false`; repeat after every reconnect and periodically while active to recover missed Redis events. This feed includes creates, edits, deletes and pin/unpin changes from this release onward. Initial loading still needs message history, because pre-release messages have no change entries. Delivery/read states use existing delivery endpoints/events and are not separate entries in this feed.

History `/conversations/{id}/messages?limit=50&offset=0` consistently selects the newest page and returns that page in chronological order. Increase offset to load older pages. New arrivals can shift offset pagination; deduplicate by message ID. For initial load, establish the socket, buffer incoming events, load history and changes, then reconcile by ID.

## Deployment and Frontend Rollout

Deploy backend migrations before enabling the new frontend. Existing JWT-only installations need one new login to create a durable device session. A frontend that ignores refresh_token will still stop working when its access token expires. Coordinate the frontend refresh rollout with this release.

Backend environment names: `S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PREFIX`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `SESSION_IDLE_DAYS`, `CORS_ORIGINS`, `AUTH_COOKIE_SAMESITE`. Credentials belong only in private environment files, never frontend bundles or Git.

Tests cover real S3 PNG upload/read, WAV presign PUT/read, auth rotation/reuse, concurrent refresh, session ownership/logout, WebSocket revocation, group add/remove permissions, message edit/delete/pin, change replay, concurrent dedup and call end permissions. Browser/native rendering and real WebRTC media quality still require client-device testing. Push delivery needs an actual FCM/APNs provider; no push credentials were supplied. TURN/SFU provisioning is separate from this session/storage release.
