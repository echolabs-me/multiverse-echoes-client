/**
 * ME-MIS-001 §5.2 hibernation / archive helpers shared across the four
 * downgrade-consent UI surfaces (hibernated Echo banner, archived Shard
 * banner, pre-confirm consent screen, Account pending-deletion list).
 *
 * Echo-side source of truth is `EchoResponse.hibernated_at` — set once
 * when the Echo is hibernated and cleared when it is woken. Shard-side
 * source of truth is `ShardSummary.provisioning_type === "Archived"`,
 * with `archived_at` and `archive_expires_at` populated iff archived.
 *
 * The 90-day deletion window mirrors
 * `me_api::data_lifecycle::GRACE_PERIOD_DAYS` — see
 * `client/src/constants/retention.ts`.
 */
import type { EchoResponse, ShardSummary, ShardDetail } from '../types/api.ts';
import { HIBERNATION_GRACE_DAYS } from '../constants/retention.ts';

/**
 * Compute the Echo's scheduled deletion instant as a `Date`.
 *
 * Returns `null` when the Echo is not hibernated (no `hibernated_at` to
 * anchor the grace window against) or the stored timestamp is
 * un-parseable.
 */
export function echoDeletionDate(
  hibernatedAt: string | null | undefined,
): Date | null {
  if (!hibernatedAt) return null;
  const anchor = new Date(hibernatedAt);
  if (Number.isNaN(anchor.getTime())) return null;
  return new Date(
    anchor.getTime() + HIBERNATION_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function isEchoHibernated(echo: Pick<EchoResponse, 'hibernated_at'>): boolean {
  return echo.hibernated_at !== null && echo.hibernated_at !== undefined;
}

export function isShardArchived(
  shard: Pick<ShardSummary | ShardDetail, 'provisioning_type'>,
): boolean {
  return shard.provisioning_type === 'Archived';
}

/**
 * Parse the server-provided `archive_expires_at` timestamp into a
 * `Date`. Unlike `echoDeletionDate` this is NOT computed client-side
 * — the server populates `archive_expires_at` at the moment the shard
 * enters the Archived state (`archived_at + GRACE_PERIOD_DAYS`, see
 * `crates/api/src/routes/shards.rs::ShardSummary::archive_expires_at`).
 *
 * Returns `null` when the shard is not archived (no timestamp to
 * anchor against) or the stored value is un-parseable.
 */
export function shardDeletionDate(
  archiveExpiresAt: string | null | undefined,
): Date | null {
  if (!archiveExpiresAt) return null;
  const d = new Date(archiveExpiresAt);
  return Number.isNaN(d.getTime()) ? null : d;
}
