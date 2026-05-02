/**
 * @echolabs/multiverse-echoes — TypeScript SDK
 *
 * Typed API client and WebSocket helpers for the Multiverse Echoes
 * Autonomous Life Simulation Platform.
 *
 * @packageDocumentation
 */

// Client
export { createClient, ApiRequestError } from './client.js';
export type { ClientOptions, MultiverseEchoesClient } from './client.js';

// WebSocket
export {
  subscribeToEcho,
  subscribeToShard,
  subscribeToChannel,
} from './websocket.js';
export type { WebSocketCallbacks, WebSocketHandle } from './websocket.js';

// Types — re-export everything for consumers
export type {
  ApiError,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  AccountType,
  SubscriptionTier,
  AccountStatus,
  User,
  EchoStatus,
  CreateEchoRequest,
  UpdatePersonaRequest,
  EchoResponse,
  Shard,
  FeedItem,
  Notification,
  EchoRelationship,
  InfluenceBalance,
  UseInfluenceRequest,
  EchoMemory,
  Channel,
  ChannelMessage,
  Conversation,
  ConversationMessage,
  SearchResult,
  SearchParams,
  ExportFormat,
  ExportStatus,
  DataExport,
  RequestExportBody,
  OracleAskRequest,
  OracleResponse,
  WaitlistSignupRequest,
  WaitlistSignupResponse,
  WaitlistPositionResponse,
  WaitlistCountResponse,
  WorldEvent,
  WorldEventPayload,
} from './types.js';
