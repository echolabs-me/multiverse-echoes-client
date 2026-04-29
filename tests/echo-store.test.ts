import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEchoStore } from '../src/stores/useEchoStore.ts';

// Amend 4 coverage — `hibernateEcho` / `wakeEcho` must use the
// server-authoritative `hibernated_at` from the endpoint response,
// never a client-generated `new Date().toISOString()` timestamp.
// Optimistic `status` flip rolls back when the network call fails.

const mocks = vi.hoisted(() => {
  return {
    hibernate: vi.fn(),
    wake: vi.fn(),
  };
});

vi.mock('../src/lib/api/endpoints.ts', () => ({
  echoes: {
    hibernate: mocks.hibernate,
    wake: mocks.wake,
  },
}));

// The store imports `safeStorage` for `reorderEchoes` — stub it so
// tests don't touch the shared localStorage JSDOM instance. `reorder`
// isn't exercised here, but `fetchEchoes` (also unused by these tests)
// reads `safeGetJSON`, so the import surface has to resolve.
vi.mock('../src/lib/safeStorage.ts', () => ({
  safeGetJSON: <T,>(_key: string, fallback: T) => fallback,
  safeSetItem: vi.fn(),
}));

const BASE_ECHO = {
  echo_id: 'e-1',
  name: 'Lily',
  persona_text: '',
  what_if_prompt: '',
  status: 'Active',
  current_mood: 'neutral',
  current_tick: 0,
  current_shard_id: 's',
  birth_hash: 'h',
  created_at: '2026-01-01T00:00:00Z',
  avatar_url: null,
  physical_description: null,
  hibernated_at: null,
} as const;

// Capture the pristine initial state to restore between tests —
// zustand stores are module-singletons and bleed state across tests
// otherwise.
const pristineState = useEchoStore.getState();

beforeEach(() => {
  mocks.hibernate.mockReset();
  mocks.wake.mockReset();
  useEchoStore.setState({
    ...pristineState,
    echoList: [{ ...BASE_ECHO }],
    activeEcho: { ...BASE_ECHO },
  });
});

afterEach(() => {
  useEchoStore.setState(pristineState);
});

describe('useEchoStore — server-authoritative hibernate', () => {
  it('commits the server hibernated_at verbatim; never a client-generated timestamp', async () => {
    // Choose a server timestamp deliberately outside any plausible
    // client clock at test execution time — if the store ever
    // re-introduces `new Date().toISOString()` as the source of
    // `hibernated_at` (the bug this amend fixes), the assertion
    // below fails with today's date instead of 1970.
    const serverHibernatedAt = '1970-01-01T00:00:00Z';
    mocks.hibernate.mockResolvedValue({
      ...BASE_ECHO,
      status: 'Hibernated',
      hibernated_at: serverHibernatedAt,
    });

    await useEchoStore.getState().hibernateEcho('e-1');

    const finalEcho = useEchoStore.getState().echoList[0];
    expect(finalEcho.status).toBe('Hibernated');
    expect(finalEcho.hibernated_at).toBe(serverHibernatedAt);
    expect(useEchoStore.getState().activeEcho?.hibernated_at).toBe(
      serverHibernatedAt,
    );
  });

  it('rolls back the optimistic status flip when the hibernate call rejects', async () => {
    mocks.hibernate.mockRejectedValue(new Error('stub server failure'));
    await expect(
      useEchoStore.getState().hibernateEcho('e-1'),
    ).rejects.toThrow('stub server failure');

    const finalEcho = useEchoStore.getState().echoList[0];
    // Pre-call status was 'Active' — rollback must restore it
    // exactly. A lingering optimistic 'Hibernated' here would mean
    // the UI lies to the user.
    expect(finalEcho.status).toBe('Active');
    expect(finalEcho.hibernated_at).toBeNull();
    expect(useEchoStore.getState().activeEcho?.status).toBe('Active');
    expect(useEchoStore.getState().activeEcho?.hibernated_at).toBeNull();
  });
});

describe('useEchoStore — server-authoritative wake', () => {
  beforeEach(() => {
    // Put the echo into Hibernated state as the pre-wake baseline.
    const hibernated = {
      ...BASE_ECHO,
      status: 'Hibernated',
      hibernated_at: '2026-03-15T09:00:00Z',
    };
    useEchoStore.setState({
      ...pristineState,
      echoList: [{ ...hibernated }],
      activeEcho: { ...hibernated },
    });
  });

  it('commits the server-cleared hibernated_at to the store', async () => {
    mocks.wake.mockResolvedValue({
      ...BASE_ECHO,
      status: 'Active',
      hibernated_at: null,
    });
    await useEchoStore.getState().wakeEcho('e-1');
    const finalEcho = useEchoStore.getState().echoList[0];
    expect(finalEcho.status).toBe('Active');
    expect(finalEcho.hibernated_at).toBeNull();
    expect(useEchoStore.getState().activeEcho?.status).toBe('Active');
    expect(useEchoStore.getState().activeEcho?.hibernated_at).toBeNull();
  });

  it('rolls back the optimistic status flip when the wake call rejects', async () => {
    mocks.wake.mockRejectedValue(new Error('stub server failure'));
    await expect(
      useEchoStore.getState().wakeEcho('e-1'),
    ).rejects.toThrow('stub server failure');

    const finalEcho = useEchoStore.getState().echoList[0];
    // Pre-call status was 'Hibernated' with a populated
    // hibernated_at — rollback restores both.
    expect(finalEcho.status).toBe('Hibernated');
    expect(finalEcho.hibernated_at).toBe('2026-03-15T09:00:00Z');
    expect(useEchoStore.getState().activeEcho?.status).toBe('Hibernated');
    expect(useEchoStore.getState().activeEcho?.hibernated_at).toBe(
      '2026-03-15T09:00:00Z',
    );
  });
});
