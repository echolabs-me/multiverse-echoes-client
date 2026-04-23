import { describe, it, expect } from 'vitest';
import {
  echoDeletionDate,
  isEchoHibernated,
  isShardArchived,
  shardDeletionDate,
} from '../hibernation.ts';
import { HIBERNATION_GRACE_DAYS } from '../../constants/retention.ts';

describe('echoDeletionDate', () => {
  it('returns 90 days after hibernated_at for a hibernated Echo', () => {
    const hibernatedAt = '2026-01-15T12:00:00Z';
    const result = echoDeletionDate(hibernatedAt);
    const expected = new Date('2026-04-15T12:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.getTime()).toBe(expected.getTime());
  });

  it('uses the HIBERNATION_GRACE_DAYS constant as the offset', () => {
    const hibernatedAt = '2026-01-01T00:00:00Z';
    const result = echoDeletionDate(hibernatedAt);
    const diffMs = result!.getTime() - new Date(hibernatedAt).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(HIBERNATION_GRACE_DAYS);
  });

  it('returns null when hibernated_at is null', () => {
    expect(echoDeletionDate(null)).toBeNull();
  });

  it('returns null when hibernated_at is undefined', () => {
    expect(echoDeletionDate(undefined)).toBeNull();
  });

  it('returns null when hibernated_at is not a parseable date', () => {
    expect(echoDeletionDate('not-a-date')).toBeNull();
  });
});

describe('isEchoHibernated', () => {
  it('returns true when hibernated_at is a timestamp string', () => {
    expect(isEchoHibernated({ hibernated_at: '2026-01-15T12:00:00Z' })).toBe(true);
  });

  it('returns false when hibernated_at is null', () => {
    expect(isEchoHibernated({ hibernated_at: null })).toBe(false);
  });
});

describe('isShardArchived', () => {
  it('returns true when provisioning_type is exactly "Archived"', () => {
    expect(isShardArchived({ provisioning_type: 'Archived' })).toBe(true);
  });

  it('returns false when provisioning_type is "Included"', () => {
    expect(isShardArchived({ provisioning_type: 'Included' })).toBe(false);
  });

  it('returns false when provisioning_type is "PaidAddon"', () => {
    expect(isShardArchived({ provisioning_type: 'PaidAddon' })).toBe(false);
  });
});

describe('shardDeletionDate', () => {
  it('parses a valid ISO timestamp into a Date at the same instant', () => {
    const iso = '2026-07-15T09:30:00Z';
    const result = shardDeletionDate(iso);
    expect(result).not.toBeNull();
    expect(result?.getTime()).toBe(new Date(iso).getTime());
  });

  it('returns null when archive_expires_at is null', () => {
    expect(shardDeletionDate(null)).toBeNull();
  });

  it('returns null when archive_expires_at is undefined', () => {
    expect(shardDeletionDate(undefined)).toBeNull();
  });

  it('returns null when archive_expires_at is un-parseable', () => {
    expect(shardDeletionDate('not-a-date')).toBeNull();
  });
});
