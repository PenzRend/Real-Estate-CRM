# Android call capture (groundwork)

Goal: every call an agent makes or takes with a client on their Android phone
lands on that client's timeline by itself ("Kimenő hívás (2 perc)"), without
typing anything. The server side is done; the phone app is still to be built.

## What is ready

- **Phone keys:** Beállítások → Kapcsolatok → *Hívásnapló Androidról* →
  name the phone → **Telefon hozzáadása**. The server address and the key are
  shown once; each phone gets its own key; **Kikapcsolás** switches one off.
  Only the key's SHA-256 hash is stored (`phone_keys`).
- **Endpoint:** `POST /api/calls`

  ```http
  POST /api/calls
  Authorization: Bearer <key>
  Content-Type: application/json

  { "number": "+36301234567", "direction": "outgoing",
    "startedAt": "2026-10-29T15:00:00+01:00", "durationSeconds": 125 }
  ```

  or a batch of up to 50 (after being offline): `{ "calls": [ … ] }`.
  `direction`: `incoming`, `outgoing` or `missed`. Numbers may be in any
  Hungarian format (`06 30 …`, `+36 30 …`).

  Response `200 { "results": ["logged" | "duplicate" | "unknown_number" | "invalid", …] }`,
  one per call; `401` for an unknown or switched-off key, `400` for a malformed body.

- **Matching:** the last 9 digits of the number against the workspace's active
  clients (the most recently contacted wins). Calls with numbers that are not a
  client's are **not stored** — private calls stay private. Sending a call
  again is harmless (`duplicate`). Calls older than 30 days are refused.
- Answered calls also update the client's "last contact".

## The phone app (to build)

A small Kotlin app, distributed outside Google Play or as a private/managed
app: Google Play allows `READ_CALL_LOG` only for default dialer/assistant apps,
so a public Play listing would be rejected.

1. **Setup screen:** server address + key (paste, or scan a QR code — a QR
   on the Settings card is an easy follow-up), "Test" button.
2. **Permissions:** `READ_CALL_LOG`, `READ_PHONE_STATE`; `POST_NOTIFICATIONS`.
3. **After each call:** listen for `TelephonyManager` call-state changes
   (IDLE after OFFHOOK/RINGING), then read the newest `CallLog.Calls` row
   (`NUMBER`, `TYPE`, `DATE`, `DURATION`) and queue it.
4. **Sending:** `WorkManager` job with network constraint; send the queue as a
   batch, drop sent items, retry with back-off on `503`/no network; on `401`
   stop and ask for a new key.
5. **Optional next step:** after an answered call with a client, a notification
   "Hogy ment?" that opens the client in the CRM (`/clients/<id>`) — needs the
   endpoint to return the client id, a small addition.

## Not covered

- iPhone: iOS gives apps no access to the call log; there the one-tap "Hívás"
  button and "Hogy ment?" in the CRM remain the way.
- Call recording or transcription.
