/**
 * Client Extension Point Registry
 *
 * Provides named "slots" where modders can inject custom React components
 * into the official client UI. Components registered to a slot are rendered
 * in the order they were registered.
 *
 * Slot locations:
 *   - dashboard-panel:    Extra panels below the main Echo panel on Dashboard
 *   - echo-detail-panel:  Extra sections on the Echo Detail page
 *   - shard-view-panel:   Extra sections on the Shard View page
 *   - settings-tab:       Additional tabs in Settings
 *   - sidebar-footer:     Content at the bottom of the sidebar
 *
 * Usage from a mod:
 *   import { registerExtension } from './lib/extensions';
 *   registerExtension('dashboard-panel', {
 *     id: 'my-mod-analytics',
 *     name: 'Echo Analytics',
 *     component: MyAnalyticsPanel,
 *   });
 */

import type { ComponentType } from 'react';

/** Props passed to extension components by the host slot. */
export interface ExtensionProps {
  /** Current echo id (if applicable to the slot context) */
  echoId?: string;
  /** Current shard id (if applicable to the slot context) */
  shardId?: string;
}

export type SlotName =
  | 'dashboard-panel'
  | 'echo-detail-panel'
  | 'shard-view-panel'
  | 'settings-tab'
  | 'sidebar-footer';

export interface ExtensionRegistration {
  /** Unique identifier for this extension */
  id: string;
  /** Display name (shown in settings/debug) */
  name: string;
  /** The React component to render in the slot */
  component: ComponentType<ExtensionProps>;
}

type SlotRegistry = Record<SlotName, ExtensionRegistration[]>;

const registry: SlotRegistry = {
  'dashboard-panel': [],
  'echo-detail-panel': [],
  'shard-view-panel': [],
  'settings-tab': [],
  'sidebar-footer': [],
};

/** Listeners notified when registry changes. */
const listeners: Set<() => void> = new Set();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Register a component extension into a named slot. */
export function registerExtension(
  slot: SlotName,
  registration: ExtensionRegistration,
): void {
  const existing = registry[slot].findIndex((r) => r.id === registration.id);
  if (existing >= 0) {
    registry[slot][existing] = registration;
  } else {
    registry[slot].push(registration);
  }
  notify();
}

/** Unregister an extension by id from a slot. */
export function unregisterExtension(slot: SlotName, id: string): boolean {
  const idx = registry[slot].findIndex((r) => r.id === id);
  if (idx < 0) return false;
  registry[slot].splice(idx, 1);
  notify();
  return true;
}

/** Get all extensions registered in a slot. */
export function getExtensions(
  slot: SlotName,
): readonly ExtensionRegistration[] {
  return registry[slot];
}

/** Subscribe to registry changes. Returns unsubscribe function. */
export function subscribeExtensions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
