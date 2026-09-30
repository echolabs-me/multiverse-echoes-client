/**
 * Compile-time parity between the hand-written types in `api.ts` and the
 * types Specta generates from the Rust structs they mirror (`generated.ts`).
 *
 * Nothing here runs. `npm run typecheck` fails when a hand-written type and
 * its Rust counterpart drift apart: a field added on one side only, a changed
 * type, or changed nullability. A hand-written type whose Rust struct Specta
 * does not export has no line here.
 */
import type * as Api from './api.ts';
import type * as Gen from './generated.ts';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Compiles only for `true`. */
type Expect<T extends true> = T;

/**
 * For a struct with `#[serde(default)]` fields. Specta marks those optional,
 * because a request may omit them, while a response always carries them. The
 * fields and their types are compared, and their optionality is not.
 */
type SameFields<A, B> = Equal<Required<A>, Required<B>>;

export type ApiTypeParity = [
  Expect<Equal<Api.ChannelMessage, Gen.MessageResponse>>,
  Expect<Equal<Api.Channel, Gen.ChannelResponse>>,
  Expect<Equal<Api.ApiKey, Gen.ApiKeyListItem>>,
  Expect<Equal<Api.UserReport, Gen.ReportResponse>>,
  Expect<Equal<Api.OracleResponse, Gen.OracleAskResponse>>,
  Expect<Equal<Api.EchoMemory, Gen.MemoryView>>,
  Expect<Equal<Api.AdminEchoSummary, Gen.AdminEchoSummary>>,
  // The server's `status`, `format` and `role` are strings, and its search
  // `item_type` has a sixth value the routes the client calls never send; the
  // hand-written types narrow them to the values the handlers send.
  Expect<
    Equal<
      Omit<Api.SearchResult, 'item_type'>,
      Omit<Gen.SearchResult, 'item_type'>
    >
  >,
  Expect<
    Equal<
      Omit<Api.DataExport, 'status' | 'format'>,
      Omit<Gen.StoryExportResponse, 'status' | 'format'>
    >
  >,
  Expect<
    Equal<
      Omit<Api.ConversationMessage, 'role'>,
      Omit<Gen.ConversationMessageResponse, 'role'>
    >
  >,
  Expect<
    Equal<
      Omit<Api.FeedbackEntry, 'context'>,
      Omit<Gen.FeedbackEntryView, 'context'>
    >
  >,
  Expect<SameFields<Api.FeedbackContext, Gen.FeedbackContext>>,
  Expect<SameFields<Api.ModerationAction, Gen.ModerationAction>>,
  // Specta skips `metadata`, which the server does send.
  Expect<SameFields<Omit<Api.PaymentRecord, 'metadata'>, Gen.PaymentRecord>>,
  Expect<SameFields<Api.CreateApiKeyRequest, Gen.CreateApiKeyRequest>>,
];
