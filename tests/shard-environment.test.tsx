import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ShardEnvironment3D } from '../src/components/ShardEnvironment3D.tsx';
import { shardNameToTheme } from '../src/lib/shardTheme.ts';

// happy-dom has no WebGL → renders static gradient fallback in all cases.

describe('shardNameToTheme', () => {
  it('maps Cyber-Tokyo shard name', () => {
    expect(shardNameToTheme('Cyber-Tokyo 2045')).toBe('cyber-tokyo');
  });

  it('maps Nomad Australia shard name', () => {
    expect(shardNameToTheme('Nomad Australia 2030')).toBe('nomad-australia');
  });

  it('maps Renaissance Florence shard name', () => {
    expect(shardNameToTheme('Renaissance Florence 1490')).toBe(
      'renaissance-florence',
    );
  });

  it('maps Personal Shard', () => {
    expect(shardNameToTheme('Personal Shard')).toBe('personal');
  });

  it('returns default for unknown shard', () => {
    expect(shardNameToTheme('Some Unknown Shard')).toBe('default');
  });
});

describe('ShardEnvironment3D', () => {
  it('renders static fallback (no GPU in test env)', () => {
    const { container } = render(
      <ShardEnvironment3D shardName="Cyber-Tokyo 2045" />,
    );
    // Static fallback is an absolute div with gradient background.
    const fallback = container.querySelector('[aria-hidden="true"]');
    expect(fallback).toBeTruthy();
    const style = fallback?.getAttribute('style') ?? '';
    // Cyber-Tokyo uses #070b14 as bg.
    expect(style).toContain('#070b14');
  });

  it('renders different gradient for each shard', () => {
    const { container: c1 } = render(
      <ShardEnvironment3D shardName="Cyber-Tokyo 2045" />,
    );
    const { container: c2 } = render(
      <ShardEnvironment3D shardName="Nomad Australia 2030" />,
    );
    const s1 =
      c1.querySelector('[aria-hidden="true"]')?.getAttribute('style') ?? '';
    const s2 =
      c2.querySelector('[aria-hidden="true"]')?.getAttribute('style') ?? '';
    // They should have different bg colours.
    expect(s1).not.toBe(s2);
  });

  it('renders fallback when disable3D is true', () => {
    const { container } = render(
      <ShardEnvironment3D shardName="Personal Shard" disable3D />,
    );
    const fallback = container.querySelector('[aria-hidden="true"]');
    expect(fallback).toBeTruthy();
  });

  it('is aria-hidden (background is decorative)', () => {
    const { container } = render(
      <ShardEnvironment3D shardName="Renaissance Florence 1490" />,
    );
    const el = container.querySelector('[aria-hidden="true"]');
    expect(el).toBeTruthy();
  });
});
