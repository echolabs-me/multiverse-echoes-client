import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import {
  useCurrentKey,
  useLatestLoad,
  whenCurrent,
} from '../src/hooks/useCurrentKey.ts';

// R360.2: the key the hook holds changes in the commit that renders the new
// key, before any passive effect, so a check made in a layout effect
// declared after the hook already finds a load for the earlier key stale.
// Layout effects run in declaration order within a component.
describe('useCurrentKey', () => {
  it('finds a load for the earlier key not current in the commit that renders the new key', () => {
    const seen: Array<{ key: string; earlierCurrent: boolean }> = [];
    function Probe({ id }: { id: string }) {
      const isCurrent = useCurrentKey(id);
      useLayoutEffect(() => {
        seen.push({ key: id, earlierCurrent: isCurrent('A')() });
      }, [id, isCurrent]);
      return null;
    }

    const { rerender } = render(<Probe id="A" />);
    rerender(<Probe id="B" />);

    expect(seen).toEqual([
      { key: 'A', earlierCurrent: true },
      { key: 'B', earlierCurrent: false },
    ]);
  });

  it('reads no key current after the page that held it unmounts (R371.3)', () => {
    let check: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      check = useCurrentKey(id);
      return null;
    }
    const { unmount } = render(<Probe id="A" />);
    const visit = check?.('A');
    expect(visit?.()).toBe(true);
    unmount();
    expect(visit?.()).toBe(false);
    expect(check?.('A')()).toBe(false);
  });

  it('compares keys with Object.is, so a composed string key is one key', () => {
    let check: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      check = useCurrentKey(id);
      return null;
    }
    render(<Probe id={JSON.stringify(['echo-1', 'happy'])} />);
    expect(check?.(JSON.stringify(['echo-1', 'happy']))()).toBe(true);
    expect(check?.(JSON.stringify(['echo-1', 'sad']))()).toBe(false);
  });

  // R434.1 (rule 5): a key that returns is a new visit, so a load started in
  // the first visit to A is not current in the second.
  it('finds a load from an earlier visit to the same key not current', () => {
    let check: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      check = useCurrentKey(id);
      return null;
    }
    const { rerender } = render(<Probe id="A" />);
    const firstVisit = check?.('A');
    rerender(<Probe id="B" />);
    rerender(<Probe id="A" />);
    const secondVisit = check?.('A');
    expect([firstVisit?.(), secondVisit?.()]).toEqual([false, true]);
  });

  it('keeps the visit when the page renders again with the same key', () => {
    let check: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string; tick: number }) {
      check = useCurrentKey(id);
      return null;
    }
    const { rerender } = render(<Probe id="A" tick={0} />);
    const visit = check?.('A');
    rerender(<Probe id="A" tick={1} />);
    expect(visit?.()).toBe(true);
  });
});

// R381.1: of two loads started for one key, only the later one may write.
describe('useLatestLoad', () => {
  it('finds an earlier load for the same key not current once a later one starts', () => {
    let start: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      start = useLatestLoad(id);
      return null;
    }
    const { unmount } = render(<Probe id="A" />);
    const first = start?.('A');
    expect(first?.()).toBe(true);
    const second = start?.('A');
    expect(first?.()).toBe(false);
    expect(second?.()).toBe(true);
    unmount();
    expect(second?.()).toBe(false);
  });
});

// R434.1 (rule 5): of loads for one key, one started in an earlier visit
// is not current, even when no later load has started.
describe('useLatestLoad, a key that returns', () => {
  it('finds a load from the first visit to A not current in the second', () => {
    let start: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      start = useLatestLoad(id);
      return null;
    }
    const { rerender } = render(<Probe id="A" />);
    const fromFirstA = start?.('A');
    rerender(<Probe id="B" />);
    rerender(<Probe id="A" />);
    expect(fromFirstA?.()).toBe(false);
  });
});

// R390.3a: a load started for a key that is not current is no load.
describe('useLatestLoad, a call kept from an earlier key', () => {
  it('starts no load for the earlier key, so the current key’s load still writes', () => {
    let start: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      start = useLatestLoad(id);
      return null;
    }
    const { rerender } = render(<Probe id="A" />);
    const keptFromA = start;
    rerender(<Probe id="B" />);
    const forB = start?.('B');
    expect(forB?.()).toBe(true);

    const lateForA = keptFromA?.('A');
    expect(lateForA?.()).toBe(false);
    expect(forB?.()).toBe(true);
  });

  it('lets a mutation’s second start make its answer the newest write (R390.3b)', () => {
    let start: ((k: string) => () => boolean) | undefined;
    function Probe({ id }: { id: string }) {
      start = useLatestLoad(id);
      return null;
    }
    render(<Probe id="A" />);
    // The mutation starts, then a reload starts while it is pending.
    start?.('A');
    const reload = start?.('A');
    // The answer arrives: the mutation starts again and writes.
    const answer = start?.('A');
    expect(answer?.()).toBe(true);
    expect(reload?.()).toBe(false);
  });
});

// R422.1: a superseded load's answer, success or failure, writes nothing.
describe('whenCurrent', () => {
  // Fake timers, so `settled` can run every timer, however late, that the
  // work's answer could schedule: a promise that settles after any of them
  // is not "never".
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const settled = async <T,>(p: Promise<T>) => {
    let outcome: string = 'pending';
    p.then(
      (v) => {
        outcome = `resolved ${String(v)}`;
      },
      (e: unknown) => {
        outcome = `rejected ${String(e)}`;
      },
    );
    // Let every queued microtask run, and every timer queued meanwhile.
    await vi.runAllTimersAsync();
    return outcome;
  };

  it('settles as the work does while the load is current', async () => {
    expect(await settled(whenCurrent(() => true, Promise.resolve('ok')))).toBe(
      'resolved ok',
    );
    expect(
      await settled(whenCurrent(() => true, Promise.reject(new Error('down')))),
    ).toBe('rejected Error: down');
  });

  it('never settles a superseded load, success or failure', async () => {
    expect(await settled(whenCurrent(() => false, Promise.resolve('ok')))).toBe(
      'pending',
    );
    expect(
      await settled(
        whenCurrent(() => false, Promise.reject(new Error('down'))),
      ),
    ).toBe('pending');
  });

  it('reads the load as current when the work settles, not when it starts', async () => {
    let current = true;
    let finish: (v: string) => void = () => {};
    const work = new Promise<string>((r) => {
      finish = r;
    });
    const gated = whenCurrent(() => current, work);
    current = false;
    finish('late');
    expect(await settled(gated)).toBe('pending');
  });
});
