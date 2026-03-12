# Messenger Backend

## Distributed Architecture

`Client -> WebSocket Gateway -> Redis ingress.events -> RabbitMQ messaging.events -> Worker -> PostgreSQL(partitioned messages) -> Redis conversation/user channels -> WebSocket clients`

`Application Services -> RabbitMQ analytics.events -> Analytics Worker -> PostgreSQL analytics tables`

`Offline Notification -> RabbitMQ notification.events -> Worker -> Push Notification Service`

## Services

- `api`: FastAPI REST APIs
- `websocket`: FastAPI WebSocket gateway
- `workers`: message persistence, delivery state transitions, partition maintenance, offline notifications
- `analytics-worker`: analytics ingestion and aggregation
- `redis`: pub/sub, presence, cache, rate limiting
- `rabbitmq`: durable queues and retries
- `postgres`: transactional data + analytics storage
- `minio`: S3-compatible attachment storage

## Scale Features

- partitioned `messages` table by `created_at` month ranges
- automatic partition creation via `ensure_messages_partitions(months_ahead)`
- message idempotency via `message_dedup_keys`
- delivery state machine (`queued`, `persisted`, `delivered`, `read`, `failed`)
- multi-device presence and typing with Redis
- Redis conversation metadata and recent message cache
- analytics queue decoupled from realtime path

## Redis Key Structures

- `user:{id}:presence`
- `user:{id}:sessions`
- `session:{session_id}:presence`
- `presence:online_users`
- `presence:last_seen`
- `conversation:{id}:typing`
- `conversation:{id}:meta`
- `conversation:{id}:participants`
- `conversation:{id}:recent_messages`
- `user:{id}:conversation_ids`
- `conversation:{id}:ws_instances`
- `ratelimit:messages:{user_id}:{epoch_second}`

## WebSocket Protocol

Endpoint:

- `ws://<host>:8001/ws/chat?token=<jwt>&session_id=<optional>&device_id=<optional>`

Inbound events:

- `send_message`
- `delivery_ack`
- `read_receipt`
- `typing_start`
- `typing_stop`
- `typing`
- `edit_message`
- `delete_message`
- `join_conversation`
- `leave_conversation`
- `active_conversation`
- `sync_missed`

Outbound events:

- `connected`
- `message_queued`
- `message_persisted`
- `message_persisted_ack`
- `message_retrying`
- `message_failed`
- `message_delivered`
- `message_read`
- `message_delivery_state`
- `typing_start`
- `typing_stop`
- `user_online`
- `user_offline`
- `last_seen_update`
- `missed_messages`
- `rate_limited`

## API Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `POST /conversations`
- `GET /conversations`
- `GET /conversations/{id}`
- `POST /conversations/{id}/members`
- `DELETE /conversations/{id}/members/{user_id}`
- `GET /conversations/{id}/messages`
- `GET /conversations/{id}/messages/search?q=...`
- `PATCH /messages/{message_id}`
- `DELETE /messages/{message_id}`
- `POST /messages/{message_id}/read`
- `GET /messages/{message_id}/delivery`
- `POST /files/presign`
- `GET /presence/users/{user_id}`
- `GET /presence/users/online`
- `GET /presence/conversations/{conversation_id}/typing`
- `POST /presence/active-conversation`

## Run

1. Copy `.env.example` to `.env`.
2. Start:

```bash
docker compose up --build
```

3. Scale websocket and workers:

```bash
docker compose up --scale websocket=4 --scale workers=6 --scale analytics-worker=2
```
