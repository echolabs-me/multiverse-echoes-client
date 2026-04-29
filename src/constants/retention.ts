/**
 * Retention windows shared across ME-MIS-001 §5.2 downgrade consent
 * surfaces. The authoritative value lives on the server — see
 * `crates/api/src/data_lifecycle.rs` `GRACE_PERIOD_DAYS` — and this
 * constant must stay in sync. ME-MIS-001 §5.2 ties both the Echo
 * hibernation grace and the Private Shard archive retention to the
 * same 90-day window and the same daily sweep.
 */
export const HIBERNATION_GRACE_DAYS = 90;
