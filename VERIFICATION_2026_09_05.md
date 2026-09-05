# Verification Record: 2026-09-05

Release implementation: `7faddca`. Migration head: `20260905_0012`.
Production: `https://messanger.cognilabs.org` on `157.180.74.22`.

## Automated Integration Results

Four integration tests passed against isolated API, WebSocket, worker and PostgreSQL resources, with Redis database 9 and separate RabbitMQ queues. Runtime: 42.22 seconds. Storage checks used the actual Hetzner S3 bucket, only under `u-message/`.

Covered behaviors:

- Access/refresh issuance, token rotation and refresh reuse revocation.
- Two concurrent refresh requests: one succeeds, one detects reuse and revokes the session.
- Device ownership, session listing, individual revocation and logout-all.
- Logout invalidates subsequent REST calls and closes the open WebSocket.
- Web HttpOnly/Secure cookie issuance, allowed Origin refresh and rejected foreign Origin.
- Group creation, member addition by a member, creator-only member removal.
- PNG upload, signed S3 read and attachment delivery to a second user.
- Unauthorized file access before message sharing and after removal/deletion.
- REST edit/delete broadcasts, pin state and change cursor recovery.
- Parallel read receipts and same-ID message creation.
- Rejection of another sender reusing a message ID.
- Call initiator-only end-for-all and removed-member call access denial.
- Direct presigned WAV PUT and GET, Range 206, nonempty/maximum-size checks.
- Approximately 10 MB multipart upload and exact downloaded-byte comparison.

## Additional Failure Recovery Checks

Stopped the QA worker, sent a message over WebSocket, observed a queued acknowledgement and empty history. Restarted the worker and verified the same message was persisted. Restarted the QA API and verified that an existing device session still authenticated.

## Production Checks

- Database backup taken before migration; previous source built as rollback image.
- RabbitMQ data copied from original anonymous volume to an external named volume with the original node hostname preserved.
- Existing analytics queue backlog consumed after deployment; production messaging, notification and analytics queues each have an active consumer.
- Public HTTPS upload, WSS two-user delivery and signed S3 reads passed for a real PNG and WAV voice message.
- Public refresh, logout, REST edit realtime event and change recovery passed.
- Direct unsigned S3 object access returns 403.
- API/WebSocket, PostgreSQL, Redis and RabbitMQ report healthy; worker running.
- Nginx configuration validates; host Nginx active and Certbot timer enabled.
- Application image excludes `.env`, `.env.docker` and `.git`.

## Boundaries

This verifies backend transport and storage, not rendering or recording in a real frontend. Actual browser/native playback, cross-site cookie behavior for the final frontend origin, real video-call media quality and load testing are not certified by these tests. No FCM/APNs integration or TURN/SFU service was configured in this release. Strict refresh rotation can require login again after a lost refresh response; frontend must coordinate refresh requests across tabs.

The production smoke test records exact fixture IDs and object keys for cleanup. QA database and tiny QA media fixtures are separate from production message data. The pre-deploy database/environment backup and previous RabbitMQ volume are intentionally retained for rollback.
