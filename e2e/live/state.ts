/**
 * Shared state between global setup/teardown and live test specs.
 *
 * A JSON file in test-results/ holds the admin token, invite code, generated
 * test email, and (once tests create it) the user + echo ids. This file
 * bridges the Playwright global-setup → spec → global-teardown lifecycle.
 *
 * NEVER log the full contents of this file — the admin token is there.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type LiveState = {
  baseURL: string;
  adminToken: string;
  inviteCode: string;
  testEmail: string;
  testPassword: string;
  testDisplayName: string;
  userId?: string;
  echoId?: string;
};

const STATE_PATH = resolve(process.cwd(), 'test-results/.live-state.json');

export function saveState(state: LiveState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function loadState(): LiveState {
  if (!existsSync(STATE_PATH)) {
    throw new Error(
      `Live state file missing at ${STATE_PATH}. Did global-setup run?`,
    );
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as LiveState;
}

export function updateState(patch: Partial<LiveState>): LiveState {
  const current = loadState();
  const next = { ...current, ...patch };
  saveState(next);
  return next;
}

export function statePath(): string {
  return STATE_PATH;
}

export function maskToken(token: string): string {
  if (token.length <= 12) return '***';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
