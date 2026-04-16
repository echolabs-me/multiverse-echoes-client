#!/usr/bin/env node
/**
 * Dynamic i18n key validator — checks that all runtime-constructed t() keys
 * resolve to real entries in en.json. Catches drift between enum values
 * (moods, relationship types, shard statuses, feed types, export statuses)
 * and the locale key tree.
 *
 * Usage: node scripts/check-dynamic-keys.js
 * Add to CI or pre-commit to catch missing keys before they reach users.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const en = JSON.parse(readFileSync(join(ROOT, 'src/locales/en.json'), 'utf8'));

function resolve(obj, dotPath) {
  const parts = dotPath.split('.');
  let current = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[p];
  }
  return current;
}

// Every dynamic t() call site and the set of runtime values it can produce.
// When you add a new enum value to the backend, add it here too.
const DYNAMIC_KEYS = [
  // moods.* — moodLabel.ts, activity hints
  ...['happy', 'content', 'sad', 'melancholy', 'angry', 'anxious', 'restless',
      'calm', 'excited', 'contemplative', 'neutral', 'unknown']
    .map((m) => `moods.${m}`),

  // relationships.* — EchoDetailPage relationship_type + status
  ...['Friend', 'Rival', 'RomanticPartner', 'Colleague', 'Acquaintance',
      'Family', 'Mentor', 'Adversary']
    .map((r) => `relationships.${r}`),
  ...['Active', 'Inactive', 'Broken', 'Faded', 'Ended', 'Severed']
    .map((s) => `relationships.${s}`),

  // feedTypes.* — PersonalFeedPage, SocialFeedPage
  ...['diary_entry', 'life_event', 'relationship_change', 'achievement',
      'global_event_participation', 'user_shared']
    .map((f) => `feedTypes.${f}`),

  // export.status* — StoryExportModal
  ...['statusPending', 'statusProcessing', 'statusComplete', 'statusFailed',
      'statusReady']
    .map((s) => `export.${s}`),

  // shardNames.* / shardDescriptions.* — StoryExportModal, ShardBrowserPage
  ...['cyber-tokyo-2045', 'nomad-australia-2030', 'renaissance-florence-1490']
    .flatMap((s) => [`shardNames.${s}`, `shardDescriptions.${s}`]),

  // shardBrowser.status* / type*
  ...['statusActive', 'statusInactive', 'statusPaused', 'statusArchived',
      'statusPendingDeletion']
    .map((s) => `shardBrowser.${s}`),
  ...['typePublic', 'typePersonal', 'typePrivate']
    .map((t) => `shardBrowser.${t}`),

  // shardView.status* / type*
  ...['statusActive', 'statusInactive', 'statusHibernated', 'statusPaused',
      'statusArchived', 'statusPendingDeletion']
    .map((s) => `shardView.${s}`),
  ...['typePublic', 'typePersonal', 'typePrivate']
    .map((t) => `shardView.${t}`),

  // website.howItWorks.step*
  ...['step1Title', 'step1Desc', 'step2Title', 'step2Desc',
      'step3Title', 'step3Desc', 'step4Title', 'step4Desc']
    .map((s) => `website.howItWorks.${s}`),
];

const missing = [];
for (const key of DYNAMIC_KEYS) {
  if (resolve(en, key) === undefined) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} dynamic i18n key(s) missing from en.json:`);
  for (const k of missing) {
    console.error(`  ${k}`);
  }
  console.error('');
  console.error('Add the missing keys to en.json and all locale files.');
  process.exit(1);
} else {
  console.log(`Dynamic key check passed. ${DYNAMIC_KEYS.length} runtime keys verified against en.json.`);
}
