import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TickPulse } from '../src/components/TickPulse.tsx';

describe('TickPulse', () => {
  it('renders children', () => {
    render(
      <TickPulse>
        <span>Echo Portrait</span>
      </TickPulse>,
    );
    expect(screen.getByText('Echo Portrait')).toBeInTheDocument();
  });

  it('does not show pulse initially', () => {
    const { container } = render(
      <TickPulse>
        <span>Test</span>
      </TickPulse>,
    );
    // No pulse element should exist at start.
    const pulse = container.querySelector('.animate-tick-pulse');
    expect(pulse).toBeNull();
  });

  it('shows pulse after interval', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <TickPulse intervalMs={1000}>
        <span>Test</span>
      </TickPulse>,
    );

    // Advance past the interval.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const pulse = container.querySelector('.animate-tick-pulse');
    expect(pulse).toBeTruthy();
    expect(pulse?.getAttribute('aria-hidden')).toBe('true');

    vi.useRealTimers();
  });

  it('pulse disappears after duration', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <TickPulse intervalMs={1000}>
        <span>Test</span>
      </TickPulse>,
    );

    // Trigger pulse.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(container.querySelector('.animate-tick-pulse')).toBeTruthy();

    // Wait for pulse to end (1s duration).
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(container.querySelector('.animate-tick-pulse')).toBeNull();

    vi.useRealTimers();
  });

  it('does not pulse when disabled', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <TickPulse intervalMs={1000} disabled>
        <span>Test</span>
      </TickPulse>,
    );

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(container.querySelector('.animate-tick-pulse')).toBeNull();
    vi.useRealTimers();
  });
});
