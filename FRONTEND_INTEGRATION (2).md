# Frontend Integration Guide

This document defines the API and WebSocket contract for the Messenger backend.
Use it as the single source of truth for frontend implementation.

## 1. Base URLs

- REST API base URL: `https://<api-domain>` (local example: `http://localhost:8000`)
- WebSocket base URL: `wss://<ws-domain>/ws/chat` (local example: `ws://localhost:8001/ws/chat`)

Recommended production routing:

- `api.example.com` -> REST (`:8000`)
- `ws.example.com` -> WebSocket gateway (`:8001`)

## 2. Auth

All protected REST endpoints require:

- `Authorization: Bearer <access_token>`

WebSocket auth is query param:

- `wss://<ws-domain>/ws/chat?token=<jwt>&session_id=<optional>&device_id=<optional>`

Token TTL is configured by backend (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, default 60 minutes).

## 3. Data Enums

### Conversation type

- `direct`
- `group`

### Message type

- `text`
- `image`
- `file`
- `voice`
- `video_note`
- `system`

### Delivery state

- `queued`
- `persisted`
- `delivered`
- `read`
- `failed`

### Call type

- `audio`
- `video`

### Call state

- `ringing`
- `active`
- `ended`
- `missed`
- `rejected`
- `cancelled`
- `failed`

## 4. REST Endpoints

## 4.1 Auth

### POST `/auth/register`

Request:

```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "Password123!"
}
```

Response `201` (UserOut):

```json
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "full_name": null,
  "avatar_url": null,
  "role_id": null,
  "department_id": null,
  "title": null,
  "about": null,
  "timezone": "UTC",
  "phone": null,
  "handle": null,
  "office_location": null,
  "manager_id": null,
  "last_seen_at": null,
  "status": "available",
  "created_at": "2026-03-18T12:00:00+00:00"
}
```

### POST `/auth/login`

Request:

```json
{
  "identifier": "john",
  "password": "Password123!"
}
```

Response `200`:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

## 4.2 Users

### GET `/users/me`

Response `200`: `UserOut`

### PATCH `/users/me`

Request fields are partial.

```json
{
  "full_name": "John Doe",
  "avatar_url": "https://...",
  "timezone": "Asia/Tashkent",
  "about": "Hello"
}
```

Response `200`: updated `UserOut`

### PATCH `/users/me/status`

```json
{
  "status": "busy"
}
```

Response `200`: updated `UserOut`

### GET `/users?q=<term>&limit=20&offset=0&include_self=false`

Response `200`: `UserOut[]`

## 4.3 Conversations

### POST `/conversations`

Direct example:

```json
{
  "type": "direct",
  "participant_ids": [2]
}
```

Group example:

```json
{
  "type": "group",
  "title": "Backend Team",
  "participant_ids": [2, 3, 4]
}
```

Response `200`:

```json
{
  "id": 10,
  "type": "direct",
  "title": null,
  "created_by_user_id": 1,
  "created_at": "2026-03-18T12:00:00+00:00",
  "participants": [
    {
      "user_id": 1,
      "username": "john",
      "role": "member",
      "joined_at": "2026-03-18T12:00:00+00:00"
    },
    {
      "user_id": 2,
      "username": "alice",
      "role": "member",
      "joined_at": "2026-03-18T12:00:00+00:00"
    }
  ]
}
```

### GET `/conversations?limit=50&offset=0`

Response `200`: `ConversationOut[]`

### GET `/conversations/{conversation_id}`

Response `200`: `ConversationOut`

### POST `/conversations/{conversation_id}/members`

Any current group member can add users to a group.

```json
{
  "user_ids": [5, 6]
}
```

Response `200`: `ConversationOut`

### DELETE `/conversations/{conversation_id}/members/{user_id}`

Only the group creator can remove other users from a group.

Response `200`: `ConversationOut`

## 4.4 Messages

### GET `/conversations/{conversation_id}/messages?limit=50&offset=0`

Response `200`: `MessageOut[]`

### GET `/conversations/{conversation_id}/messages/latest`

Response `200`: `MessageOut | null`

### GET `/conversations/{conversation_id}/messages/pinned?limit=50&offset=0`

Response `200`: `MessageOut[]`

### GET `/conversations/{conversation_id}/messages/search?q=hello&limit=25&offset=0`

Response `200`:

```json
[
  {
    "message": { "id": 100, "conversation_id": 10, "client_message_id": "...", "message_type": "text", "content": "hello", "reply_to_message_id": null, "forwarded_from_message_id": null, "is_pinned": false, "pinned_by_user_id": null, "pinned_at": null, "attachments": [], "status": "sent", "delivery_state": "persisted", "queued_at": null, "persisted_at": null, "delivered_at": null, "read_at": null, "delivery_updated_at": null, "created_at": "...", "edited_at": null, "deleted_at": null, "sender_id": 1, "sender": { "id": 1, "username": "john" } },
    "rank": 0.42
  }
]
```

### PATCH `/messages/{message_id}`

```json
{
  "content": "edited text"
}
```

Response `200`: `MessageOut`

### DELETE `/messages/{message_id}`

Response `200`: `MessageOut`

### POST `/messages/{message_id}/pin`

Response `200`: `MessageOut`

### POST `/messages/{message_id}/unpin`

Response `200`: `MessageOut`

### POST `/messages/{message_id}/read`

Response `200`:

```json
{
  "id": 1,
  "message_id": 100,
  "conversation_id": 10,
  "user_id": 2,
  "read_at": "2026-03-18T12:05:00+00:00"
}
```

### GET `/messages/{message_id}/delivery`

Response `200`: `DeliveryReceiptOut[]`

## 4.5 File Upload (ImageKit flow)

### POST `/files/upload-local`

Content-Type: `multipart/form-data`

Field:

- `file`: binary

Response `200`:

```json
{
  "bucket": "imagekit",
  "object_key": "/messenger/u-1/uuid-file.png",
  "original_name": "file.png",
  "mime_type": "image/png",
  "size_bytes": 12345,
  "public_url": "https://ik.imagekit.io/<id>/messenger/u-1/uuid-file.png",
  "metadata_json": {
    "duration_ms": 3200,
    "width": 360,
    "height": 360,
    "waveform": [2, 8, 6, 10, 4]
  }
}
```

Use this output directly in WS `send_message.attachments`.

Default max upload size is `100MB` (`LOCAL_UPLOAD_MAX_SIZE_MB` env).
If exceeded, API returns `413`.

### POST `/files/presign`

Current deployment mode usually returns `503` if ImageKit direct local upload is enabled and S3 presign is disabled.

## 4.6 Presence

### GET `/presence/users/online?limit=5000`

Response `200`: `[1,2,3,...]`

### GET `/presence/users/{user_id}`

Response `200`:

```json
{
  "user_id": 2,
  "is_online": true,
  "active_conversation_id": 10,
  "sessions": 1,
  "last_seen": "2026-03-18T12:05:00+00:00",
  "updated_at": "2026-03-18T12:05:00+00:00"
}
```

### GET `/presence/conversations/{conversation_id}/typing`

Response `200`:

```json
{
  "conversation_id": 10,
  "user_ids": [2]
}
```

### POST `/presence/active-conversation`

```json
{
  "conversation_id": 10
}
```

Response `200`: `PresenceStateOut`

## 4.7 Calls

### GET `/calls/history?limit=30&offset=0`

Response `200`:

```json
{
  "total": 3,
  "calls": [
    {
      "id": "call_abcd1234",
      "conversation_id": 10,
      "initiator_id": 1,
      "call_type": "video",
      "state": "ended",
      "started_at": "2026-03-18T12:10:00+00:00",
      "ended_at": "2026-03-18T12:11:00+00:00",
      "created_at": "2026-03-18T12:10:00+00:00",
      "updated_at": "2026-03-18T12:11:00+00:00",
      "participants": [
        {
          "user_id": 1,
          "state": "left",
          "is_online_when_invited": true,
          "joined_at": "2026-03-18T12:10:00+00:00",
          "left_at": "2026-03-18T12:11:00+00:00",
          "created_at": "2026-03-18T12:10:00+00:00"
        },
        {
          "user_id": 2,
          "state": "left",
          "is_online_when_invited": true,
          "joined_at": "2026-03-18T12:10:05+00:00",
          "left_at": "2026-03-18T12:11:00+00:00",
          "created_at": "2026-03-18T12:10:00+00:00"
        }
      ]
    }
  ]
}
```

### GET `/calls/{call_id}`

Response `200`: `CallSessionOut`

## 5. WebSocket Protocol

Endpoint:

- `ws://localhost:8001/ws/chat?token=<jwt>&session_id=<optional>&device_id=<optional>`

All WS messages have envelope:

```json
{
  "event": "event_name",
  "payload": { }
}
```

## 5.1 On connect

Server event:

```json
{
  "event": "connected",
  "payload": {
    "user_id": 1,
    "session_id": "client-session-id",
    "rooms": [10, 11],
    "online_users": [1, 2, 5],
    "rate_limit_per_second": 8
  }
}
```

Note: right after socket open, presence events like `user_online` may arrive before `connected`.
Client should handle events by type, not by strict order.

## 5.2 Inbound WS events (client -> server)

### `send_message`

```json
{
  "event": "send_message",
  "payload": {
    "conversation_id": 10,
    "content": "hello",
    "type": "text",
    "client_message_id": "msg_12345678",
    "reply_to_message_id": null,
    "forwarded_from_message_id": null,
    "attachments": []
  }
}
```

For `image/file/voice/video_note`, `attachments` must be non-empty.

Attachment shape:

```json
{
  "bucket": "imagekit",
  "object_key": "/messenger/u-1/uuid-file.png",
  "original_name": "file.png",
  "mime_type": "image/png",
  "size_bytes": 12345,
  "public_url": "https://...",
  "metadata_json": {
    "duration_ms": 3200,
    "width": 360,
    "height": 360,
    "waveform": [2, 8, 6, 10, 4]
  }
}
```

### `delivery_ack`

```json
{
  "event": "delivery_ack",
  "payload": {
    "message_id": 100
  }
}
```

### `read_receipt`

```json
{
  "event": "read_receipt",
  "payload": {
    "message_id": 100
  }
}
```

### Typing

```json
{ "event": "typing_start", "payload": { "conversation_id": 10 } }
{ "event": "typing_stop", "payload": { "conversation_id": 10 } }
```

Legacy (still supported):

```json
{ "event": "typing", "payload": { "conversation_id": 10, "is_typing": true } }
```

### Edit/Delete message

```json
{ "event": "edit_message", "payload": { "message_id": 100, "content": "edited" } }
{ "event": "delete_message", "payload": { "message_id": 100 } }
```

### Pin/Unpin message

```json
{ "event": "pin_message", "payload": { "message_id": 100 } }
{ "event": "unpin_message", "payload": { "message_id": 100 } }
```

### Room management

```json
{ "event": "join_conversation", "payload": { "conversation_id": 10 } }
{ "event": "leave_conversation", "payload": { "conversation_id": 10 } }
```

### Active conversation

```json
{ "event": "active_conversation", "payload": { "conversation_id": 10 } }
```

Or clear:

```json
{ "event": "active_conversation", "payload": { "conversation_id": null } }
```

### Sync missed messages

```json
{
  "event": "sync_missed",
  "payload": {
    "conversation_id": 10,
    "last_message_id": 230,
    "limit": 100
  }
}
```

### Call events

```json
{ "event": "call_invite", "payload": { "conversation_id": 10, "call_type": "audio", "call_id": "call_custom_1234" } }
{ "event": "call_accept", "payload": { "call_id": "call_custom_1234" } }
{ "event": "call_reject", "payload": { "call_id": "call_custom_1234" } }
{ "event": "call_end", "payload": { "call_id": "call_custom_1234" } }
```

WebRTC signaling relay:

```json
{
  "event": "call_signal",
  "payload": {
    "call_id": "call_custom_1234",
    "target_user_id": 2,
    "signal_type": "offer",
    "sdp": "v=0...",
    "candidate": null
  }
}
```

## 5.3 Outbound WS events (server -> client)

### Message lifecycle

- `message_queued`
- `message_persisted`
- `message_persisted_ack`
- `message_retrying`
- `message_failed`
- `message_delivered`
- `message_read`
- `message_delivery_state`
- `message_edited`
- `message_deleted`
- `message_pinned`
- `message_unpinned`
- `conversation_members_added`
- `conversation_member_removed`
- `conversation_removed`

`message_persisted` payload is full `MessageOut`.

`conversation_members_added` payload is `ConversationOut`.

`conversation_member_removed` payload:

```json
{
  "conversation": {},
  "removed_user_id": 5
}
```

`conversation_removed` is sent directly to removed user:

```json
{
  "conversation_id": 10
}
```

### Typing/presence

- `typing_start`
- `typing_stop`
- `user_online`
- `user_offline`
- `last_seen_update`
- `active_conversation_set`
- `joined_conversation`
- `left_conversation`

### Read/delivery queue acknowledgements

- `delivery_ack_queued`
- `read_ack_queued`

### Sync response

- `missed_messages`

### Call signaling events

- `call_invite_ack`
- `incoming_call`
- `call_signal_sent`
- `call_signal`
- `call_accepted`
- `call_rejected`
- `call_ended`
- `call_participant_left`

### Error and limits

- `error`
- `rate_limited`

`rate_limited` payload:

```json
{
  "event": "rate_limited",
  "payload": {
    "detail": "Message rate limit exceeded",
    "reset_at_epoch": 1773855000
  }
}
```

`error` payload:

```json
{
  "event": "error",
  "payload": {
    "detail": "..."
  }
}
```

Validation errors may return `detail` as an array of field errors.

## 6. Calling Flow (Frontend)

This backend provides signaling and call state. Media transport is WebRTC in frontend.

## 6.1 Outgoing call

1. Caller sends `call_invite`:

```json
{
  "event": "call_invite",
  "payload": {
    "conversation_id": 10,
    "call_type": "video",
    "call_id": "call_custom_1234"
  }
}
```

2. Caller gets `call_invite_ack`:

```json
{
  "event": "call_invite_ack",
  "payload": {
    "call": { "id": "call_custom_1234", "state": "ringing", "...": "..." },
    "online_user_ids": [2],
    "offline_user_ids": []
  }
}
```

3. Callee gets `incoming_call` with same `call` object.

`incoming_call` payload:

```json
{
  "event": "incoming_call",
  "payload": {
    "call": { "id": "call_custom_1234", "...": "..." },
    "from_user_id": 1
  }
}
```

4. Callee accepts/rejects:

```json
{ "event": "call_accept", "payload": { "call_id": "call_custom_1234" } }
{ "event": "call_reject", "payload": { "call_id": "call_custom_1234" } }
```

Participants receive:

- `call_accepted` with payload `{ "call": <CallSessionOut>, "user_id": <actorId> }`
- `call_rejected` with payload `{ "call": <CallSessionOut>, "user_id": <actorId> }`

5. Exchange WebRTC signaling via `call_signal`:

```json
{
  "event": "call_signal",
  "payload": {
    "call_id": "call_custom_1234",
    "target_user_id": 2,
    "signal_type": "offer",
    "sdp": "v=0...",
    "candidate": null
  }
}
```

Server forwards to target as `call_signal` with `from_user_id`.

Forwarded `call_signal` payload format:

```json
{
  "event": "call_signal",
  "payload": {
    "call_id": "call_custom_1234",
    "conversation_id": 10,
    "from_user_id": 1,
    "target_user_id": 2,
    "signal_type": "offer",
    "sdp": "v=0...",
    "candidate": null
  }
}
```

6. End call:

```json
{ "event": "call_end", "payload": { "call_id": "call_custom_1234" } }
```

Optional hard-stop for everyone:

```json
{ "event": "call_end", "payload": { "call_id": "call_custom_1234", "end_for_all": true } }
```

Behavior:

- Direct call (2 participants): `call_end` closes the call and emits `call_ended`.
- Group call (>2 participants): default `call_end` removes only actor and emits `call_participant_left`.
- Group call with `end_for_all: true`: closes whole call and emits `call_ended`.

`call_ended` payload:

```json
{
  "event": "call_ended",
  "payload": {
    "call": { "id": "call_custom_1234", "state": "ended", "...": "..." },
    "user_id": 1,
    "end_for_all": true
  }
}
```

`call_participant_left` payload:

```json
{
  "event": "call_participant_left",
  "payload": {
    "call": { "id": "call_custom_1234", "state": "active", "...": "..." },
    "user_id": 3,
    "end_for_all": false
  }
}
```

## 6.2 Offline callee behavior

If callee is offline at invite time:

- `call_invite_ack.payload.offline_user_ids` will include that user.
- `call.state` may be `missed`.
- Missed call appears in `GET /calls/history` when callee opens app.

## 7. Message + Upload Flow (Frontend)

## 7.1 Text message

1. Generate unique `client_message_id`.
2. Send `send_message` with `type: "text"`.
3. Optimistically render pending message.
4. On `message_persisted_ack` map pending message to actual `message_id`.
5. On `message_persisted` replace pending content with authoritative payload.

## 7.2 Image/file/voice message

1. Upload binary to `/files/upload-local`.
2. Receive upload response.
3. Send `send_message` with `type: "image" | "file" | "voice" | "video_note"` and `attachments: [upload_response]` mapped to attachment fields.
4. Render from `attachments[].public_url`.

## 7.3 Reply/Forward/Pin

Reply:

- set `send_message.payload.reply_to_message_id = <target_message_id>`.

Forward:

- set `send_message.payload.forwarded_from_message_id = <source_message_id>`.
- if `content`/`attachments` empty, backend copies payload from source message when allowed.

Pin:

- use REST `POST /messages/{id}/pin` or WS `pin_message`.
- unpin via REST `POST /messages/{id}/unpin` or WS `unpin_message`.
- load pinned list via REST `GET /conversations/{conversation_id}/messages/pinned`.
- realtime updates come as `message_pinned` / `message_unpinned`.

## 8. Suggested Client State Model

Maintain these stores:

- `auth`: token, current user
- `conversations`: list + members
- `messagesByConversation`: message list, pending map by `client_message_id`
- `presence`: online users, typing users, last seen
- `calls`: current call session, signaling state, history cache

## 9. Error Handling Rules

- HTTP `401`: token invalid/expired -> logout + re-login flow.
- HTTP `403`: not member or forbidden action -> show access error.
- HTTP `409`: conflict (call closed, duplicate call id) -> refetch state.
- HTTP `413`: file too large.
- HTTP `503` on `/files/presign`: use `/files/upload-local`.
- WS `error`: show non-blocking toast and reconcile state by refetching affected resource.
- WS disconnect: reconnect with exponential backoff and call `sync_missed` after reconnect.

## 10. Performance and Quality Notes for Calls

For low-latency high-quality calls you need, on frontend side:

- WebRTC with hardware-accelerated codecs where available.
- Adaptive bitrate and simulcast/SVC settings.
- Regional STUN/TURN deployment close to users.
- Jitter buffer tuning and packet loss recovery.

Backend here handles signaling/events; media quality is mainly determined by WebRTC + TURN/SFU topology.

## 11. Minimal Frontend Checklist

- Implement REST auth and token storage.
- Connect WS with token query.
- Implement messaging events and optimistic UI.
- Implement upload-local + attachment message flow.
- Implement presence + typing events.
- Implement call invite/accept/reject/end and WebRTC signaling relay.
- Implement missed-call UI using `/calls/history`.
