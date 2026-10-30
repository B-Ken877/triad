# Medika chat audit and migration map

Source repository: https://github.com/B-Ken877/medika

Primary chat page:
- `medika-web/app/app/consultations/[id]/page.tsx`

Supporting files identified:
- `medika-web/lib/ws/socket.ts`
- `medika-web/lib/ws/socket-context.tsx`
- `medika-web/lib/ws/typing.ts`
- `medika-web/lib/ws/presence.ts`
- `medika-web/lib/ws/recording.ts`
- `medika-web/lib/chat/delivery.ts`
- `medika-web/lib/chat/pending.ts`
- `medika-web/lib/chat/receipts.ts`
- `medika-web/lib/chat/emoji.ts`
- `medika-web/lib/chat/scroll.ts`
- `medika-web/lib/chat/media.ts`
- `medika-web/lib/chat/voice.ts`
- `medika-web/lib/chat/waveform.ts`
- `medika-web/components/consultation/AttachmentMenu.tsx`
- `medika-web/components/consultation/EmojiPicker.tsx`
- `medika-web/components/consultation/ReceiptTick.tsx`
- `medika-web/components/consultation/SecureMedia.tsx`
- `medika-web/components/consultation/VoiceMessageBubble.tsx`
- `medika-web/components/consultation/VoiceRecorder.tsx`
- `medika-web/components/consultation/RemoteRecordingIndicator.tsx`
- `medika-web/components/consultation/useChatScroll.ts`

## Findings

The primary page is not a generic chat page. It bootstraps a consultation, uses patient/doctor roles and consultation status transitions, handles the transition to a call route, and imports prescription modal/panel UI. Copying the page wholesale would import domain assumptions and call behavior.

The most valuable reusable engineering patterns are:
- Optimistic messages remain visibly pending/failed until persistence is confirmed.
- WebSocket send success is treated as frame buffering, not proof of database persistence.
- A persisted WebSocket echo or REST response confirms durable delivery.
- Retries reuse the same client message ID so server-side uniqueness can deduplicate.
- Read receipts are based on persisted state, not optimistic assumptions.
- Typing/presence state expires and resets on disconnect to avoid stale indicators.
- Scroll behavior accounts for late content resizing and preserves the user's reading position.

## Migration decisions

Reuse/adapt:
- Message layout and bubble presentation.
- Composer interactions, emoji insertion, day/time formatting and scroll behavior.
- Pending-send state machine, echo reconciliation and receipt derivation.
- Typing throttling, presence derivation and stale-state expiry.
- Attachment/voice UI only after removing medical language and securing storage.

Exclude:
- PrescriptionModal and PrescriptionPanel.
- Patient/doctor roles and consultation status.
- Consultation acceptance transitions and consultation-specific API endpoints.
- Call navigation, call controls, call routes and call event handling.
- ZEGO/LiveKit or any calling infrastructure.
- Any medical/patient records, production data or secrets.

## Snapshot status

The files under `reference/medika-chat/` are copied source snapshots to preserve the reviewed logic and make adaptation traceable. They are not wired into the TRIAD app and may retain Medika-specific type imports or wording. Refactor them into domain-neutral modules with tests before application use.