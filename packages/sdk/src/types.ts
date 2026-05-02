/** API response/request types for the Multiverse Echoes engine. */

// --- Common ---

export interface ApiError {
  error: { code: string; message: string };
}

export interface MessageResponse {
  message: string;
}

// --- Auth ---

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  tos_accepted: boolean;
  privacy_accepted: boolean;
  age_confirmed: boolean;
}

export interface RegisterResponse {
  user_id: string;
  display_name: string;
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

// --- User ---

export type AccountType = 'Standard' | 'Admin' | 'Bot';
export type SubscriptionTier = 'Free' | 'Basic' | 'Pro' | 'Enterprise';
export type AccountStatus = 'Active' | 'Suspended' | 'PendingDeletion';

export interface User {
  user_id: string;
  email: string;
  email_verified: boolean;
  display_name: string;
  display_name_slug: string;
  account_type: AccountType;
  subscription_tier: SubscriptionTier;
  created_at: string;
  updated_at: string;
  last_login_at: string;
  account_status: AccountStatus;
  locale: string;
  timezone: string | null;
  onboarding_complete: boolean;
  echo_count_limit: number;
  solo_mode: boolean;
}

// --- Echo ---

export type EchoStatus = 'Active' | 'Hibernated' | 'Travelling' | 'PendingDeletion';

export interface CreateEchoRequest {
  name: string;
  persona_text: string;
  what_if_prompt: string;
  age_at_creation?: number;
  persona_mode?: 'detailed' | 'quick';
  consent_declaration: boolean;
}

export interface UpdatePersonaRequest {
  persona_text?: string;
}

export interface EchoResponse {
  echo_id: string;
  name: string;
  persona_text: string;
  what_if_prompt: string;
  persona_version: number;
  status: string;
  current_mood: string;
  current_tick: number;
  birth_hash: string;
  created_at: string;
}

// --- Shard ---

export interface Shard {
  shard_id: string;
  name: string;
  description: string;
  shard_type: string;
  status: string;
  owner_user_id: string | null;
  echo_count: number;
  max_capacity: number;
  created_at: string;
}

// --- Feed ---

export interface FeedItem {
  item_id: string;
  echo_id: string;
  owner_user_id: string;
  shard_id: string;
  item_type: string;
  title: string;
  body: string;
  significance: number;
  created_at: string;
}

// --- Notification ---

export interface Notification {
  notification_id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

// --- Relationship ---

export interface EchoRelationship {
  relationship_id: string;
  source_echo_id: string;
  target_echo_id: string;
  target_echo_name: string;
  relationship_type: string;
  sentiment: number;
  status: string;
  last_interaction_tick: number;
  created_at: string;
}

// --- Influence ---

export interface InfluenceBalance {
  echo_id: string;
  /** `null` for uncapped tiers (GodMode); finite number otherwise. */
  daily_limit: number | null;
  /** `null` when daily_limit is null; finite number otherwise. */
  used_today: number | null;
  /** `null` when daily_limit is null; finite number otherwise. */
  remaining: number | null;
}

export interface UseInfluenceRequest {
  influence_type: string;
  details?: string;
}

// --- Memory ---

export interface EchoMemory {
  memory_id: string;
  echo_id: string;
  content: string;
  memory_type: string;
  strength: number;
  created_at: string;
}

// --- Channel ---

export interface Channel {
  channel_id: string;
  name: string;
  channel_type: string;
  shard_id: string | null;
  description: string;
  created_at: string;
}

export interface ChannelMessage {
  message_id: string;
  channel_id: string;
  user_id: string;
  display_name: string;
  body: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

// --- Conversation ---

export interface Conversation {
  conversation_id: string;
  echo_id: string;
  user_id: string;
  status: 'Active' | 'Closed';
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  message_id: string;
  conversation_id: string;
  role: 'user' | 'echo';
  content: string;
  created_at: string;
}

// --- Search ---

export interface SearchResult {
  id: string;
  result_type: 'Echo' | 'DiaryEntry' | 'LifeEvent' | 'Shard' | 'Message';
  title: string;
  snippet: string;
  echo_id?: string;
  shard_id?: string;
  created_at: string;
}

export interface SearchParams {
  q: string;
  echo_id?: string;
  shard_id?: string;
  content_type?: string;
  date_from?: string;
  date_to?: string;
}

// --- Data Export ---

export type ExportFormat = 'text' | 'json' | 'pdf' | 'video' | 'book';
export type ExportStatus = 'Pending' | 'Processing' | 'Ready' | 'Failed';

export interface DataExport {
  export_id: string;
  status: ExportStatus;
  format: ExportFormat;
  download_url?: string;
  download_path?: string;
  subtitle_path?: string;
  created_at: string;
}

export interface RequestExportBody {
  echo_id: string;
  format: ExportFormat;
}

// --- Oracle ---

export interface OracleAskRequest {
  question: string;
  context?: { echo_id?: string; shard_id?: string; screen?: string };
}

export interface OracleResponse {
  answer: string;
  deep_links?: Array<{ label: string; path: string }>;
}

// --- Waitlist ---

export interface WaitlistSignupRequest {
  email: string;
  referral_code?: string;
  source?: string;
}

export interface WaitlistSignupResponse {
  entry_id: string;
  position: number;
  referral_code: string;
}

export interface WaitlistPositionResponse {
  entry_id: string;
  position: number;
  status: string;
  referral_code: string;
  referral_count: number;
}

export interface WaitlistCountResponse {
  count: number;
}

// --- WebSocket Events ---

export interface WorldEvent {
  event_id: string;
  tick_id: number;
  timestamp: string;
  payload: WorldEventPayload;
}

export type WorldEventPayload =
  | { type: 'DiaryEntryCreated'; echo_id: string; entry_id: string }
  | { type: 'LifeEventOccurred'; echo_id: string; event_id: string }
  | { type: 'MoodChanged'; echo_id: string; mood: string }
  | { type: 'EchoInteraction'; source_id: string; target_id: string }
  | { type: 'EchoHibernated'; echo_id: string }
  | { type: 'EchoWoken'; echo_id: string }
  | { type: 'ShardTravelCompleted'; echo_id: string; shard_id: string }
  | { type: 'CommunityMessagePosted'; channel_id: string; message_id: string }
  | { type: 'NotificationCreated'; notification_id: string }
  | { type: string; [key: string]: unknown };
