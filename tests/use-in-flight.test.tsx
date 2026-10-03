import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInFlight } from '../src/hooks/useInFlight.ts';
import { markers, type Marker } from '../src/lib/inFlightMarkers.ts';

/** R288.3, R288.6: the hook and the module that builds its markers. */
describe('useInFlight (R288.6)', () => {
  it('two runs of one marker, the second before the first settles, send once', async () => {
    const { result } = renderHook(() => useInFlight());
    const send = vi.fn(() => new Promise<void>(() => {}));
    await act(async () => {
      void result.current.run(markers.logout(), send);
      void result.current.run(markers.logout(), send);
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.isHeld(markers.logout())).toBe(true);
  });
});

describe('markers (R288.3)', () => {
  it("each write's marker begins with its function's key", () => {
    const made = Object.entries(markers).map(([key, make]) => {
      const marker = (make as (...args: string[]) => Marker)('page', 'x');
      return { key, marker };
    });
    expect(made.length).toBeGreaterThan(0);
    for (const { key, marker } of made) {
      expect(marker === key || marker.startsWith(`${key}:`), marker).toBe(true);
    }
    expect(new Set(made.map((m) => m.marker)).size).toBe(made.length);
  });
});
