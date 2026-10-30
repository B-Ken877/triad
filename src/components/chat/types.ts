/**
 * TRIAD chat UI view-model types — domain-neutral presentation contracts.
 *
 * Components in `components/chat/` consume these shapes only: no healthcare
 * roles, no consultation lifecycle, no transport or persistence knowledge.
 * Project persistence/authorization stays behind the caller (issue #3).
 */

import type { OutgoingMessageState } from "@/lib/chat/types";

/** Presentation-ready message row. `mine` is resolved by the caller. */
export interface ChatMessageView {
  id: string;
  /** Present for outgoing messages; required for the retry affordance. */
  clientMsgId?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
  mine: boolean;
  /** Outgoing lifecycle; incoming messages omit it. */
  state?: OutgoingMessageState;
}

/** Conversation-level status surfaced by the list. */
export type ChatListStatus = "loading" | "ready" | "error";

export interface ChatListStateProps {
  status: ChatListStatus;
  /** Banner text shown while the transport is offline/reconnecting. */
  connection: "online" | "offline" | "reconnecting";
  errorMessage?: string;
  emptyMessage?: string;
}
