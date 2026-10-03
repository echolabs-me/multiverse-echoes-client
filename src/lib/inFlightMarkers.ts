/**
 * The one module that builds in-flight markers (R288.3). Each write has one
 * function here, and the marker it makes begins with that function's key,
 * so two writes never share a marker. `useInFlight` takes only a `Marker`,
 * which nothing outside this module can make.
 *
 * What a marker names depends on the write (R288.4):
 * - a write that sets something on a target is the same write from any
 *   control, so its marker carries the target alone;
 * - a write that makes a new thing each time, an upload, is one write per
 *   control, so its marker carries the control as well as the target.
 */

declare const markerBrand: unique symbol;

/** A held-write name. Only `markers` makes one. */
export type Marker = string & { readonly [markerBrand]: true };

/** Where an upload's control sits. */
export type UploadControl = 'page' | 'sidebar';

/** What each write's marker carries after its key. */
const parts = {
  // The session and the account. Their target is the account signed in, and
  // the store holds every marker with the sign-in session that sent it
  // (R296.1).
  logout: () => [],
  soloMode: () => [],
  communityOptOut: () => [],
  doNotSell: () => [],
  discordLink: () => [],
  discordUnlink: () => [],
  revokeSession: (sessionId: string) => [sessionId],
  notificationPref: (key: string) => [key],
  // Community.
  vote: (messageId: string) => [messageId],
  editMessage: (messageId: string) => [messageId],
  deleteMessage: (messageId: string) => [messageId],
  upload: (control: UploadControl, channelId: string) => [control, channelId],
  // Another user's profile.
  following: (userId: string) => [userId],
  blocked: (userId: string) => [userId],
  muted: (userId: string) => [userId],
  // Notifications.
  markRead: (notificationId: string) => [notificationId],
  markAllRead: () => [],
  // Marketplace.
  buy: (itemId: string) => [itemId],
  equip: (itemId: string) => [itemId],
  // A voice call with an Echo.
  endVoiceSession: (echoId: string) => [echoId],
  // Admin.
  resolveReport: (reportId: string) => [reportId],
  suspend: (userId: string) => [userId],
  tickState: () => [],
  tickTrigger: () => [],
  feedbackStatus: (feedbackId: string) => [feedbackId],
  feedbackPriority: (feedbackId: string) => [feedbackId],
  feedbackIssue: (feedbackId: string) => [feedbackId],
  promote: (userId: string) => [userId],
  demote: (userId: string) => [userId],
  revokeShareToken: (token: string) => [token],
} satisfies Record<string, (...args: never[]) => string[]>;

type Parts = typeof parts;

export type Markers = {
  readonly [K in keyof Parts]: (...args: Parameters<Parts[K]>) => Marker;
};

/** One function per write; each marker begins with its function's key. */
export const markers = Object.fromEntries(
  Object.entries(parts).map(([key, of]) => [
    key,
    (...args: never[]) =>
      [key, ...(of as (...a: never[]) => string[])(...args)].join(':'),
  ]),
) as Markers;
