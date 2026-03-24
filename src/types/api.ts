/** API response/request types matching the Rust engine */

// --- Common ---

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
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
  tos_accepted_at: string;
  tos_version: string;
  privacy_accepted_at: string;
  privacy_version: string;
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
