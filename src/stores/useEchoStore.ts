import { create } from 'zustand';
import type { EchoResponse, CreateEchoRequest } from '../types/api.ts';
import { echoes } from '../lib/api/endpoints.ts';
import { safeGetJSON, safeSetItem } from '../lib/safeStorage.ts';

interface EchoState {
  echoList: EchoResponse[];
  activeEcho: EchoResponse | null;
  isLoading: boolean;

  fetchEchoes: () => Promise<void>;
  fetchEcho: (id: string) => Promise<void>;
  createEcho: (data: CreateEchoRequest) => Promise<EchoResponse>;
  deleteEcho: (id: string) => Promise<void>;
  hibernateEcho: (id: string) => Promise<void>;
  wakeEcho: (id: string) => Promise<void>;
  setActiveEcho: (echo: EchoResponse | null) => void;
  reorderEchoes: (fromIndex: number, toIndex: number) => void;
}

export const useEchoStore = create<EchoState>((set, get) => ({
  echoList: [],
  activeEcho: null,
  isLoading: false,

  fetchEchoes: async () => {
    set({ isLoading: true });
    const list = await echoes.list();
    // Restore user's custom order from localStorage if available.
    // safeGetJSON clears the corrupted key on parse failure so the next
    // boot starts clean (no crash-reload loop if the stored bytes are
    // ever truncated / user-edited / shape-changed across versions).
    const savedOrder = safeGetJSON<string[]>('me_echo_order', []);
    if (savedOrder.length > 0) {
      const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
      list.sort((a, b) => {
        const ai = orderMap.get(a.echo_id) ?? 999;
        const bi = orderMap.get(b.echo_id) ?? 999;
        return ai - bi;
      });
    }
    set({ echoList: list, isLoading: false });
  },

  fetchEcho: async (id) => {
    const echo = await echoes.get(id);
    set({
      activeEcho: echo,
      echoList: get().echoList.map((e) => (e.echo_id === id ? echo : e)),
    });
  },

  createEcho: async (data) => {
    const echo = await echoes.create(data);
    set({ echoList: [...get().echoList, echo] });
    return echo;
  },

  deleteEcho: async (id) => {
    await echoes.delete(id);
    set({
      echoList: get().echoList.filter((e) => e.echo_id !== id),
      activeEcho:
        get().activeEcho?.echo_id === id ? null : get().activeEcho,
    });
  },

  hibernateEcho: async (id) => {
    // Snapshot the pre-call state so we can roll back on failure.
    // Copy by structure (not reference) so later mutations to the
    // list don't retroactively alter the rollback target.
    const prevList = get().echoList;
    const prevActive = get().activeEcho;
    const prevEntry = prevList.find((e) => e.echo_id === id);

    // Optimistic `status` flip for snappy UI. `hibernated_at` stays
    // on the previous value (null while Active) — the server owns
    // that field, so we wait for the handler response before
    // touching it. No client-generated timestamps.
    set({
      echoList: prevList.map((e) =>
        e.echo_id === id ? { ...e, status: 'Hibernated' } : e,
      ),
      activeEcho:
        prevActive?.echo_id === id
          ? { ...prevActive, status: 'Hibernated' }
          : prevActive,
    });

    try {
      // Server returns the full updated EchoResponse including the
      // authoritative `hibernated_at` instant. Merge it in verbatim
      // — do NOT overlay a client-side clock value.
      const updated = await echoes.hibernate(id);
      set({
        echoList: get().echoList.map((e) =>
          e.echo_id === id ? updated : e,
        ),
        activeEcho:
          get().activeEcho?.echo_id === id ? updated : get().activeEcho,
      });
    } catch (err) {
      // Roll back the optimistic status flip. If the entry was not
      // in the list at call time (edge case: deleted during flight),
      // we leave the list as the mutator above wrote it.
      if (prevEntry) {
        set({
          echoList: get().echoList.map((e) =>
            e.echo_id === id ? prevEntry : e,
          ),
          activeEcho:
            get().activeEcho?.echo_id === id ? prevActive : get().activeEcho,
        });
      }
      throw err;
    }
  },

  wakeEcho: async (id) => {
    const prevList = get().echoList;
    const prevActive = get().activeEcho;
    const prevEntry = prevList.find((e) => e.echo_id === id);

    set({
      echoList: prevList.map((e) =>
        e.echo_id === id ? { ...e, status: 'Active' } : e,
      ),
      activeEcho:
        prevActive?.echo_id === id
          ? { ...prevActive, status: 'Active' }
          : prevActive,
    });

    try {
      const updated = await echoes.wake(id);
      set({
        echoList: get().echoList.map((e) =>
          e.echo_id === id ? updated : e,
        ),
        activeEcho:
          get().activeEcho?.echo_id === id ? updated : get().activeEcho,
      });
    } catch (err) {
      if (prevEntry) {
        set({
          echoList: get().echoList.map((e) =>
            e.echo_id === id ? prevEntry : e,
          ),
          activeEcho:
            get().activeEcho?.echo_id === id ? prevActive : get().activeEcho,
        });
      }
      throw err;
    }
  },

  setActiveEcho: (echo) => set({ activeEcho: echo }),

  reorderEchoes: (fromIndex, toIndex) => {
    const list = [...get().echoList];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    set({ echoList: list });
    // Persist order to localStorage so it survives refreshes.
    safeSetItem('me_echo_order', JSON.stringify(list.map((e) => e.echo_id)));
  },
}));
