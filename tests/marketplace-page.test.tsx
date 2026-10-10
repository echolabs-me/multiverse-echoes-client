import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  act,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StrictMode, Profiler } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

import { MarketplacePage } from '../src/pages/MarketplacePage.tsx';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  trackEvent: vi.fn(),
  list: vi.fn(),
  preview: vi.fn(),
  purchase: vi.fn(),
  inventory: vi.fn(),
  equip: vi.fn(),
  user: { subscription_tier: 'Starter' as string } as {
    subscription_tier: string;
  } | null,
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (selector?: (s: unknown) => unknown) => {
    const state = { addToast: mocks.addToast };
    return selector ? selector(state) : state;
  },
}));

// The mock applies the selector and answers `getState` and `subscribe`, as
// the store does; it never changes, so it notifies nobody (R296.1).
vi.mock('../src/stores/useAuthStore.ts', () => {
  const state = () => ({ user: mocks.user });
  return {
    useAuthStore: Object.assign(
      (selector?: (s: unknown) => unknown) =>
        selector ? selector(state()) : state(),
      { getState: state, subscribe: () => () => {} },
    ),
  };
});

vi.mock('../src/lib/analytics.ts', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../src/lib/api/endpoints.ts', () => ({
  marketplace: {
    list: (...args: unknown[]) => mocks.list(...args),
    preview: (...args: unknown[]) => mocks.preview(...args),
    purchase: (...args: unknown[]) => mocks.purchase(...args),
    inventory: (...args: unknown[]) => mocks.inventory(...args),
    equip: (...args: unknown[]) => mocks.equip(...args),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        marketplace: {
          pageTitle: 'Marketplace',
          tabs: {
            dashboardTheme: 'Dashboard Themes',
            portraitStyle: 'Portrait Styles',
            exportTemplate: 'Export Templates',
            shardAesthetic: 'Shard Aesthetics',
            scenarioPack: 'Scenario Packs',
            seasonalCosmetic: 'Seasonal',
            soundPack: 'Sound Packs',
            myInventory: 'My Inventory',
          },
          preview: 'Preview',
          buy: 'Buy',
          owned: 'Owned',
          upgradeToUnlock: 'Upgrade to unlock',
          tierRequired: 'Tier required: {{tier}}',
          priceCoins: '{{count}} coins',
          limitedTimeRemaining: 'Ends in {{duration}}',
          equip: 'Equip',
          unequip: 'Unequip',
          equipped: 'Equipped',
          notEquipped: 'Not equipped',
          rarity: {
            common: 'Common',
            rare: 'Rare',
            epic: 'Epic',
            legendary: 'Legendary',
          },
          empty: 'No items in this category yet.',
          emptyInventory: 'Your collection is empty.',
          loadError: 'Couldn’t load the marketplace.',
          equipError: 'That toggle didn’t go through.',
        },
        common: { retry: 'Retry', close: 'Close' },
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function renderPage() {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/marketplace']}>
        <Routes>
          <Route path="/marketplace" element={<MarketplacePage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    item_id: '00000000-0000-0000-0000-000000000001',
    name: 'Aurora Skin',
    description: 'd',
    item_type: 'EchoSkin',
    category: 'PortraitStyle',
    rarity: 'Common',
    price_tier_required: 'Starter',
    price_coins: 100,
    image_url: 'https://cdn.test/aurora.png',
    is_available: true,
    is_limited_time: false,
    available_until: null,
    creator_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function inventoryRow(overrides: Record<string, unknown> = {}) {
  return {
    inventory_id: '11111111-1111-1111-1111-111111111111',
    item_id: '00000000-0000-0000-0000-000000000001',
    acquired_at: '2026-01-02T00:00:00Z',
    equipped: false,
    price_paid_coins: 100,
    item: item(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Starter user, empty list, empty inventory.
  mocks.user = { subscription_tier: 'Starter' };
  mocks.list.mockResolvedValue({ data: [], next_cursor: null });
  mocks.inventory.mockResolvedValue({ data: [], next_cursor: null });
});

// ==================================================================
// Tab strip — 1 test
// ==================================================================

describe('MarketplacePage — tabs', () => {
  it('renders 8 tabs (7 categories + My Inventory)', async () => {
    await act(async () => {
      renderPage();
    });
    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(8);
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toContain('Dashboard Themes');
    expect(labels).toContain('Portrait Styles');
    expect(labels).toContain('Export Templates');
    expect(labels).toContain('Shard Aesthetics');
    expect(labels).toContain('Scenario Packs');
    expect(labels).toContain('Seasonal');
    expect(labels).toContain('Sound Packs');
    expect(labels).toContain('My Inventory');
  });
});

// ==================================================================
// Category fetch — 2 tests
// ==================================================================

describe('MarketplacePage — category fetch', () => {
  it('clicking a category tab fetches with the correct category param', async () => {
    const user = userEvent.setup();
    await act(async () => {
      renderPage();
    });
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    mocks.list.mockClear();

    const portraitTab = await screen.findByRole('tab', {
      name: 'Portrait Styles',
    });
    await user.click(portraitTab);

    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(mocks.list).toHaveBeenCalledWith({ category: 'PortraitStyle' });
  });

  it('item grid renders the item count returned by list()', async () => {
    mocks.list.mockResolvedValue({
      data: [
        item({ item_id: 'a', name: 'A' }),
        item({ item_id: 'b', name: 'B' }),
        item({ item_id: 'c', name: 'C' }),
      ],
      next_cursor: null,
    });
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});

// ==================================================================
// Tier-gated CTA — 3 tests
// ==================================================================

describe('MarketplacePage — tier gating', () => {
  it('Free user sees "Upgrade to unlock" instead of "Buy" for a Starter+ item', async () => {
    mocks.user = { subscription_tier: 'Free' };
    mocks.list.mockResolvedValue({
      data: [item({ price_tier_required: 'Starter' })],
      next_cursor: null,
    });
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Upgrade to unlock')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Buy' }),
    ).not.toBeInTheDocument();
  });

  it('Starter+ user sees "Buy" button for an unowned Common item', async () => {
    mocks.user = { subscription_tier: 'Starter' };
    mocks.list.mockResolvedValue({
      data: [item({ price_tier_required: 'Starter' })],
      next_cursor: null,
    });
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByRole('button', { name: 'Buy' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Upgrade to unlock')).not.toBeInTheDocument();
  });

  it('Owned item shows "Owned" indicator instead of Buy', async () => {
    mocks.user = { subscription_tier: 'Starter' };
    mocks.list.mockResolvedValue({
      data: [item()],
      next_cursor: null,
    });
    mocks.inventory.mockResolvedValue({
      data: [inventoryRow()],
      next_cursor: null,
    });
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText('Owned')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Buy' }),
    ).not.toBeInTheDocument();
  });
});

// ==================================================================
// Preview modal — 1 test
// ==================================================================

describe('MarketplacePage — preview', () => {
  it('clicking Preview calls marketplace.preview() and opens the modal', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue({
      data: [item()],
      next_cursor: null,
    });
    mocks.preview.mockResolvedValue({
      item_id: '00000000-0000-0000-0000-000000000001',
      preview_image_url: 'https://cdn.test/preview/aurora.png',
      preview_demo_url: null,
      applied_to_user_dashboard: true,
    });
    await act(async () => {
      renderPage();
    });
    const previewBtn = await screen.findByRole('button', { name: 'Preview' });
    await user.click(previewBtn);

    await waitFor(() =>
      expect(mocks.preview).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
      ),
    );
    // Native <dialog> renders the modal; assert preview image present.
    await waitFor(() => {
      const img = document.querySelector(
        'dialog img[src="https://cdn.test/preview/aurora.png"]',
      );
      expect(img).toBeTruthy();
    });
  });
});

// ==================================================================
// Limited-time countdown — 1 test
// ==================================================================

describe('MarketplacePage — limited-time countdown', () => {
  it('renders countdown text for a limited-time item with future available_until', async () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    mocks.list.mockResolvedValue({
      data: [
        item({
          is_limited_time: true,
          available_until: future,
        }),
      ],
      next_cursor: null,
    });
    await act(async () => {
      renderPage();
    });
    // Format: "Ends in Nd Nh" — assert prefix to avoid clock flake.
    expect(await screen.findByText(/^Ends in /)).toBeInTheDocument();
  });
});

// ==================================================================
// Inventory tab — 2 tests
// ==================================================================

describe('MarketplacePage — inventory tab', () => {
  it('Inventory tab renders the rows returned by inventory()', async () => {
    const user = userEvent.setup();
    mocks.inventory.mockResolvedValue({
      data: [inventoryRow({ item: item({ name: 'Aurora Skin' }) })],
      next_cursor: null,
    });
    await act(async () => {
      renderPage();
    });
    const inventoryTab = await screen.findByRole('tab', {
      name: 'My Inventory',
    });
    await user.click(inventoryTab);

    await waitFor(() => expect(mocks.inventory).toHaveBeenCalled());
    // The Aurora Skin name should render inside the inventory list.
    const list = await screen.findByRole('list');
    expect(within(list).getByText('Aurora Skin')).toBeInTheDocument();
  });

  it('Equip toggle calls marketplace.equip(itemId, !current_equipped)', async () => {
    const user = userEvent.setup();
    mocks.inventory.mockResolvedValue({
      data: [
        inventoryRow({
          item_id: 'inv-1',
          equipped: false,
          item: item({ item_id: 'inv-1', name: 'Aurora Skin' }),
        }),
      ],
      next_cursor: null,
    });
    mocks.equip.mockResolvedValue(
      inventoryRow({ item_id: 'inv-1', equipped: true }),
    );
    await act(async () => {
      renderPage();
    });
    const inventoryTab = await screen.findByRole('tab', {
      name: 'My Inventory',
    });
    await user.click(inventoryTab);

    const equipBtn = await screen.findByRole('button', { name: 'Equip' });
    await user.click(equipBtn);

    await waitFor(() =>
      expect(mocks.equip).toHaveBeenCalledWith('inv-1', true),
    );
  });
});

// ==================================================================
// Each write sends once (R265)
// ==================================================================

describe('MarketplacePage — each write sends once (R265)', () => {
  it('buying an item: a double click sends one purchase, and Buy is held', async () => {
    mocks.user = { subscription_tier: 'Starter' };
    mocks.list.mockResolvedValue({
      data: [item({ price_tier_required: 'Starter' })],
      next_cursor: null,
    });
    mocks.purchase.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      renderPage();
    });
    const buy = await screen.findByRole('button', { name: 'Buy' });
    await act(async () => {
      fireEvent.click(buy);
      fireEvent.click(buy);
    });
    expect(mocks.purchase).toHaveBeenCalledTimes(1);
    expect(buy).toBeDisabled();
  });

  it('the equip toggle: a double click sends one request, never the opposite value, and the toggle is held', async () => {
    const user = userEvent.setup();
    mocks.inventory.mockResolvedValue({
      data: [
        inventoryRow({
          item_id: 'inv-1',
          equipped: false,
          item: item({ item_id: 'inv-1', name: 'Aurora Skin' }),
        }),
      ],
      next_cursor: null,
    });
    mocks.equip.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      renderPage();
    });
    await user.click(await screen.findByRole('tab', { name: 'My Inventory' }));
    const toggle = await screen.findByRole('button', { name: 'Equip' });
    await act(async () => {
      fireEvent.click(toggle);
      fireEvent.click(toggle);
    });
    expect(mocks.equip.mock.calls).toEqual([['inv-1', true]]);
    expect(
      screen.getByTestId('marketplace-inventory-equip-toggle'),
    ).toBeDisabled();
  });
});

// ==================================================================
// Optimistic-UI rollback — 1 test
// ==================================================================

describe('MarketplacePage — equip rollback', () => {
  it('rolls back the optimistic update + toasts when equip fails', async () => {
    const user = userEvent.setup();
    mocks.inventory.mockResolvedValue({
      data: [
        inventoryRow({
          item_id: 'inv-1',
          equipped: false,
          item: item({ item_id: 'inv-1', name: 'Aurora Skin' }),
        }),
      ],
      next_cursor: null,
    });
    mocks.equip.mockRejectedValue(new Error('boom'));
    await act(async () => {
      renderPage();
    });
    const inventoryTab = await screen.findByRole('tab', {
      name: 'My Inventory',
    });
    await user.click(inventoryTab);

    const equipBtn = await screen.findByRole('button', { name: 'Equip' });
    await user.click(equipBtn);

    await waitFor(() =>
      expect(mocks.addToast).toHaveBeenCalledWith(
        'That toggle didn’t go through.',
        'danger',
        // Not the server's answer, so the platform's (R283.3).
        { platformLink: true },
      ),
    );
    // Button reverts to "Equip" (was optimistically "Unequip" mid-flight).
    expect(screen.getByRole('button', { name: 'Equip' })).toBeInTheDocument();
  });
});

describe('MarketplacePage — a failed equip reads the list again (R285.3)', () => {
  const row = (id: string, name: string, equipped: boolean) =>
    inventoryRow({
      inventory_id: `row-${id}`,
      item_id: id,
      equipped,
      item: item({ item_id: id, name }),
    });

  async function openInventory() {
    const user = userEvent.setup();
    await act(async () => {
      renderPage();
    });
    await user.click(await screen.findByRole('tab', { name: 'My Inventory' }));
  }

  const toggleIn = async (id: string) =>
    within(
      await screen.findByTestId(`marketplace-inventory-row-${id}`),
    ).getByTestId('marketplace-inventory-equip-toggle');

  it("an equip that fails after another item's equip has succeeded leaves that item equipped", async () => {
    // The server's inventory, which each read returns as it is then.
    let server = [row('a', 'Aurora', false), row('b', 'Borealis', false)];
    mocks.inventory.mockImplementation(() =>
      Promise.resolve({ data: server, next_cursor: null }),
    );
    let failA!: (e: unknown) => void;
    mocks.equip.mockImplementation((id: string) => {
      if (id === 'a') {
        return new Promise((_, reject) => {
          failA = reject;
        });
      }
      server = [row('a', 'Aurora', false), row('b', 'Borealis', true)];
      return Promise.resolve(row('b', 'Borealis', true));
    });
    await openInventory();
    await act(async () => {
      fireEvent.click(await toggleIn('a'));
    });
    await act(async () => {
      fireEvent.click(await toggleIn('b'));
    });
    await waitFor(async () =>
      expect(await toggleIn('b')).toHaveTextContent('Unequip'),
    );
    await act(async () => {
      failA(new Error('boom'));
    });
    await waitFor(async () =>
      expect(await toggleIn('a')).toHaveTextContent('Equip'),
    );
    expect(await toggleIn('a')).not.toHaveTextContent('Unequip');
    expect(await toggleIn('b')).toHaveTextContent('Unequip');
  });

  it('a reload that fails after a failed equip shows the load error', async () => {
    mocks.inventory.mockResolvedValueOnce({
      data: [row('a', 'Aurora', false)],
      next_cursor: null,
    });
    mocks.inventory.mockResolvedValueOnce({
      data: [row('a', 'Aurora', false)],
      next_cursor: null,
    });
    mocks.inventory.mockRejectedValue(new Error('down'));
    mocks.equip.mockRejectedValue(new Error('boom'));
    await openInventory();
    await act(async () => {
      fireEvent.click(await toggleIn('a'));
    });
    expect(
      await screen.findByTestId('marketplace-load-error'),
    ).toHaveTextContent('Couldn’t load the marketplace.');
  });
});

// ==================================================================
// Empty states — 2 tests
// ==================================================================

describe('MarketplacePage — empty states', () => {
  it('renders the empty-category copy when list() returns no data', async () => {
    mocks.list.mockResolvedValue({ data: [], next_cursor: null });
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByText('No items in this category yet.'),
    ).toBeInTheDocument();
  });

  it('renders the empty-inventory copy on the Inventory tab when inventory() returns no rows', async () => {
    const user = userEvent.setup();
    mocks.inventory.mockResolvedValue({ data: [], next_cursor: null });
    await act(async () => {
      renderPage();
    });
    const inventoryTab = await screen.findByRole('tab', {
      name: 'My Inventory',
    });
    await user.click(inventoryTab);
    expect(
      await screen.findByText('Your collection is empty.'),
    ).toBeInTheDocument();
  });
});

// ==================================================================
// R361.4, R371.1, R381.1, R390.3: the page shows and writes only what
// its active tab names
// ==================================================================

function heldPromise<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const loadCommits: string[] = [];
/** Records the page's text at every commit of what it wraps. */
function LoadCommitProbe({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="page"
      onRender={() => {
        loadCommits.push(document.body.textContent ?? '');
      }}
    >
      {children}
    </Profiler>
  );
}

function renderForLoads({ strict = false }: { strict?: boolean } = {}) {
  const page = (
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={['/marketplace']}>
        <LoadCommitProbe>
          <Routes>
            <Route path="/marketplace" element={<MarketplacePage />} />
          </Routes>
        </LoadCommitProbe>
      </MemoryRouter>
    </I18nextProvider>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

async function openTab(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name }));
  });
}

describe('MarketplacePage — loads for the active tab (R361.4)', () => {
  beforeEach(() => {
    loadCommits.length = 0;
  });

  it('a load for an earlier category that settles after the later category’s leaves the later category’s items (R361.3)', async () => {
    const themes = heldPromise<unknown>();
    mocks.list.mockImplementation(({ category }: { category: string }) =>
      category === 'DashboardTheme'
        ? themes.promise
        : Promise.resolve({
            data: [item({ name: 'Portrait One' })],
            next_cursor: null,
          }),
    );
    await act(async () => {
      renderForLoads();
    });
    await openTab('Portrait Styles');
    expect(screen.getByText('Portrait One')).toBeInTheDocument();
    await act(async () => {
      themes.resolve({
        data: [item({ name: 'Theme One' })],
        next_cursor: null,
      });
    });
    expect(screen.getByText('Portrait One')).toBeInTheDocument();
    expect(screen.queryByText('Theme One')).toBeNull();
  });

  it('from one category’s items to another tab, no render for it shows the earlier category’s items (R371.1)', async () => {
    mocks.list.mockImplementation(({ category }: { category: string }) =>
      category === 'DashboardTheme'
        ? Promise.resolve({
            data: [item({ name: 'Theme One' })],
            next_cursor: null,
          })
        : new Promise(() => undefined),
    );
    await act(async () => {
      renderForLoads();
    });
    expect(screen.getByText('Theme One')).toBeInTheDocument();
    loadCommits.length = 0;
    await openTab('Portrait Styles');
    expect(loadCommits.length).toBeGreaterThan(0);
    for (const text of loadCommits) {
      expect(text).not.toContain('Theme One');
    }
  });

  it('of two loads for one category, an older one that fails last leaves the newer one’s items (R381.1)', async () => {
    const older = heldPromise<unknown>();
    const newer = heldPromise<unknown>();
    mocks.list
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await act(async () => {
      renderForLoads({ strict: true });
    });
    expect(mocks.list).toHaveBeenCalledTimes(2);
    await act(async () => {
      newer.resolve({ data: [item({ name: 'Theme One' })], next_cursor: null });
    });
    await act(async () => {
      older.reject(new Error('older failed'));
    });
    expect(screen.getByText('Theme One')).toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load the marketplace.')).toBeNull();
  });

  it('of two previews, an earlier one that settles later opens nothing over the later one (R381.1)', async () => {
    mocks.list.mockResolvedValue({
      data: [
        item({ name: 'First Skin' }),
        item({
          item_id: '00000000-0000-0000-0000-000000000002',
          name: 'Second Skin',
        }),
      ],
      next_cursor: null,
    });
    const first = heldPromise<unknown>();
    mocks.preview.mockImplementation((id: string) =>
      id === '00000000-0000-0000-0000-000000000001'
        ? first.promise
        : Promise.resolve({
            item_id: id,
            preview_image_url: 'https://cdn.test/preview/second.png',
            preview_demo_url: null,
            applied_to_user_dashboard: true,
          }),
    );
    await act(async () => {
      renderForLoads();
    });
    const previews = screen.getAllByRole('button', { name: 'Preview' });
    await act(async () => {
      fireEvent.click(previews[0] as HTMLElement);
    });
    await act(async () => {
      fireEvent.click(previews[1] as HTMLElement);
    });
    await act(async () => {
      first.resolve({
        item_id: '00000000-0000-0000-0000-000000000001',
        preview_image_url: 'https://cdn.test/preview/first.png',
        preview_demo_url: null,
        applied_to_user_dashboard: true,
      });
    });
    expect(
      document.querySelector(
        'dialog img[src="https://cdn.test/preview/second.png"]',
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        'dialog img[src="https://cdn.test/preview/first.png"]',
      ),
    ).toBeNull();
  });

  it('an inventory reload started while a purchase is pending writes nothing after the purchase’s answer (R390.3b)', async () => {
    mocks.list.mockResolvedValue({
      data: [item({ price_tier_required: 'Starter' })],
      next_cursor: null,
    });
    const answer = heldPromise<unknown>();
    mocks.purchase.mockReturnValue(answer.promise);
    const reload = heldPromise<unknown>();
    const bought = inventoryRow({ item: item({ name: 'Aurora Skin' }) });
    mocks.inventory
      .mockResolvedValueOnce({ data: [], next_cursor: null })
      .mockReturnValueOnce(reload.promise)
      // The read the purchase's answer starts (R422.2).
      .mockResolvedValueOnce({ data: [bought], next_cursor: null });
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Buy' }));
    });
    // Opening the inventory reloads it while the purchase is pending.
    await openTab('My Inventory');
    await act(async () => {
      answer.resolve(bought);
    });
    expect(screen.getByText('Aurora Skin')).toBeInTheDocument();
    // The reload read the inventory before the purchase landed.
    await act(async () => {
      reload.resolve({ data: [], next_cursor: null });
    });
    expect(screen.getByText('Aurora Skin')).toBeInTheDocument();
  });
});

// ==================================================================
// R422: a superseded preview shows nothing, a preview belongs to its tab,
// and a purchase never merges into an inventory no read has filled
// ==================================================================

const SECOND_ITEM_ID = '00000000-0000-0000-0000-000000000002';

function previewOf(id: string, url: string) {
  return {
    item_id: id,
    preview_image_url: url,
    preview_demo_url: null,
    applied_to_user_dashboard: true,
  };
}

describe('MarketplacePage — previews and purchases in flight (R422)', () => {
  beforeEach(() => {
    loadCommits.length = 0;
  });

  it('a preview asked for on one tab and answered after another tab opens opens nothing there (R422.3)', async () => {
    mocks.list.mockResolvedValue({ data: [item()], next_cursor: null });
    const answer = heldPromise<unknown>();
    mocks.preview.mockReturnValue(answer.promise);
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    });
    await openTab('Portrait Styles');
    await act(async () => {
      answer.resolve(
        previewOf(
          '00000000-0000-0000-0000-000000000001',
          'https://cdn.test/preview/aurora.png',
        ),
      );
    });
    expect(
      document.querySelector(
        'dialog img[src="https://cdn.test/preview/aurora.png"]',
      ),
    ).toBeNull();
  });

  it('a preview that fails after a later preview has opened shows no toast (R422.1)', async () => {
    mocks.list.mockResolvedValue({
      data: [
        item({ name: 'First Skin' }),
        item({ item_id: SECOND_ITEM_ID, name: 'Second Skin' }),
      ],
      next_cursor: null,
    });
    const first = heldPromise<unknown>();
    mocks.preview.mockImplementation((id: string) =>
      id === SECOND_ITEM_ID
        ? Promise.resolve(
            previewOf(SECOND_ITEM_ID, 'https://cdn.test/preview/second.png'),
          )
        : first.promise,
    );
    await act(async () => {
      renderForLoads();
    });
    const previews = screen.getAllByRole('button', { name: 'Preview' });
    await act(async () => {
      fireEvent.click(previews[0] as HTMLElement);
    });
    await act(async () => {
      fireEvent.click(previews[1] as HTMLElement);
    });
    await act(async () => {
      first.reject(new Error('first preview failed'));
    });
    expect(mocks.addToast).not.toHaveBeenCalled();
    expect(
      document.querySelector(
        'dialog img[src="https://cdn.test/preview/second.png"]',
      ),
    ).toBeTruthy();
  });

  it('a purchase while the inventory’s first read is pending shows the items already owned once the read after its answer lands (R422.2)', async () => {
    // The user already owns the first item; the second is bought.
    mocks.list.mockResolvedValue({
      data: [
        item({ name: 'Owned Skin' }),
        item({ item_id: SECOND_ITEM_ID, name: 'Bought Skin' }),
      ],
      next_cursor: null,
    });
    const owned = inventoryRow();
    const bought = inventoryRow({
      inventory_id: '22222222-2222-2222-2222-222222222222',
      item_id: SECOND_ITEM_ID,
      item: item({ item_id: SECOND_ITEM_ID, name: 'Bought Skin' }),
    });
    const firstRead = heldPromise<unknown>();
    mocks.inventory
      .mockReturnValueOnce(firstRead.promise)
      .mockResolvedValueOnce({ data: [owned, bought], next_cursor: null });
    mocks.purchase.mockResolvedValue(bought);
    await act(async () => {
      renderForLoads();
    });
    // The catalog has landed and the inventory's first read has not, so
    // both cards offer Buy.
    const card = (id: string) =>
      within(screen.getByTestId(`marketplace-item-card-${id}`));
    await act(async () => {
      fireEvent.click(
        card(SECOND_ITEM_ID).getByRole('button', { name: 'Buy' }),
      );
    });
    expect(mocks.inventory).toHaveBeenCalledTimes(2);
    expect(
      card('00000000-0000-0000-0000-000000000001').getByText('Owned'),
    ).toBeInTheDocument();
    expect(card(SECOND_ITEM_ID).getByText('Owned')).toBeInTheDocument();
    // The first read, superseded by the read after the purchase's answer,
    // writes nothing.
    await act(async () => {
      firstRead.resolve({ data: [], next_cursor: null });
    });
    expect(
      card('00000000-0000-0000-0000-000000000001').getByText('Owned'),
    ).toBeInTheDocument();
  });

  it.each(['answered', 'refused'] as const)(
    'a purchase that superseded the inventory’s first read writes nothing from that read, and when it is %s the read it starts shows the items owned and ends the loading (R463.2)',
    async (outcome) => {
      mocks.list.mockResolvedValue({
        data: [
          item({ name: 'Owned Skin' }),
          item({ item_id: SECOND_ITEM_ID, name: 'Wanted Skin' }),
        ],
        next_cursor: null,
      });
      const firstRead = heldPromise<unknown>();
      const readAfter = heldPromise<unknown>();
      mocks.inventory
        .mockReturnValueOnce(firstRead.promise)
        .mockReturnValueOnce(readAfter.promise);
      const answer = heldPromise<unknown>();
      mocks.purchase.mockReturnValue(answer.promise);
      await act(async () => {
        renderForLoads();
      });
      const card = (id: string) =>
        within(screen.getByTestId(`marketplace-item-card-${id}`));
      await act(async () => {
        fireEvent.click(
          card(SECOND_ITEM_ID).getByRole('button', { name: 'Buy' }),
        );
      });
      // The first read lands while the purchase is pending: the purchase
      // superseded it, so it writes nothing, and the inventory still loads.
      await act(async () => {
        firstRead.resolve({ data: [inventoryRow()], next_cursor: null });
      });
      expect(
        card('00000000-0000-0000-0000-000000000001').queryByText('Owned'),
      ).toBeNull();
      await act(async () => {
        if (outcome === 'answered') {
          answer.resolve(
            inventoryRow({
              inventory_id: '22222222-2222-2222-2222-222222222222',
              item_id: SECOND_ITEM_ID,
              item: item({ item_id: SECOND_ITEM_ID, name: 'Wanted Skin' }),
            }),
          );
        } else {
          answer.reject(new Error('refused'));
        }
      });
      expect(mocks.inventory).toHaveBeenCalledTimes(2);
      await act(async () => {
        readAfter.resolve({ data: [inventoryRow()], next_cursor: null });
      });
      // The read the purchase started is the inventory's newest write.
      expect(
        card('00000000-0000-0000-0000-000000000001').getByText('Owned'),
      ).toBeInTheDocument();
      expect(
        card(SECOND_ITEM_ID).getByRole('button', { name: 'Buy' }),
      ).toBeInTheDocument();
    },
  );

  it('a bought item shows as owned as soon as its purchase is answered, until the read after it lands (R422.2)', async () => {
    mocks.list.mockResolvedValue({ data: [item()], next_cursor: null });
    const readAfter = heldPromise<unknown>();
    mocks.inventory
      .mockResolvedValueOnce({ data: [], next_cursor: null })
      .mockReturnValueOnce(readAfter.promise);
    mocks.purchase.mockResolvedValue(inventoryRow());
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Buy' }));
    });
    expect(mocks.inventory).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Owned')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy' })).toBeNull();
    // The read's answer replaces what shows as owned.
    await act(async () => {
      readAfter.resolve({ data: [], next_cursor: null });
    });
    expect(screen.queryByText('Owned')).toBeNull();
    expect(screen.getByRole('button', { name: 'Buy' })).toBeInTheDocument();
  });
});

// ==================================================================
// R422 pass 1: an equip's marker is released when its answer lands, and a
// tab change ends a pending preview
// ==================================================================

describe('MarketplacePage — an equip and a preview against later loads (R422)', () => {
  beforeEach(() => {
    loadCommits.length = 0;
  });

  it.each(['succeeds', 'fails'] as const)(
    'an item’s toggle is enabled again once its equip %s, even when a later inventory read supersedes the read after it (R422.1)',
    async (outcome) => {
      const rows = {
        data: [
          inventoryRow({
            item_id: 'a',
            item: item({ item_id: 'a', name: 'Aurora' }),
          }),
        ],
        next_cursor: null,
      };
      const readAfterEquip = heldPromise<unknown>();
      mocks.inventory
        // The mount read and the Inventory tab's read.
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce(rows)
        // The read the equip's answer starts, which never lands first.
        .mockReturnValueOnce(readAfterEquip.promise)
        .mockResolvedValue(rows);
      if (outcome === 'succeeds') {
        mocks.equip.mockResolvedValue(
          inventoryRow({ item_id: 'a', equipped: true }),
        );
      } else {
        mocks.equip.mockRejectedValue(new Error('boom'));
      }
      await act(async () => {
        renderForLoads();
      });
      await openTab('My Inventory');
      await act(async () => {
        fireEvent.click(
          screen.getByTestId('marketplace-inventory-equip-toggle'),
        );
      });
      expect(mocks.equip).toHaveBeenCalledWith('a', true);
      expect(mocks.inventory).toHaveBeenCalledTimes(3);
      // Opening the Inventory tab again reads it again, which supersedes the
      // read the equip started.
      await openTab('Portrait Styles');
      await openTab('My Inventory');
      expect(mocks.inventory).toHaveBeenCalledTimes(4);
      expect(
        screen.getByTestId('marketplace-inventory-equip-toggle'),
      ).toBeEnabled();
      await act(async () => {
        readAfterEquip.resolve(rows);
      });
      expect(
        screen.getByTestId('marketplace-inventory-equip-toggle'),
      ).toBeEnabled();
    },
  );

  it('a preview asked for on one tab and answered after a move to another tab and back opens nothing (R422.3)', async () => {
    mocks.list.mockResolvedValue({ data: [item()], next_cursor: null });
    const answer = heldPromise<unknown>();
    mocks.preview.mockReturnValue(answer.promise);
    await act(async () => {
      renderForLoads();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    });
    await openTab('Portrait Styles');
    await openTab('Dashboard Themes');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    await act(async () => {
      answer.resolve(
        previewOf(
          '00000000-0000-0000-0000-000000000001',
          'https://cdn.test/preview/aurora.png',
        ),
      );
    });
    expect(
      document.querySelector(
        'dialog img[src="https://cdn.test/preview/aurora.png"]',
      ),
    ).toBeNull();
    expect(mocks.trackEvent).not.toHaveBeenCalledWith(
      'marketplace.item_viewed',
      expect.anything(),
    );
  });
});

// ==================================================================
// R463.2: two equips, the second answered before the read the first
// started is rendered
// ==================================================================

describe('MarketplacePage — two equips over each other’s reads (R463.2)', () => {
  it('two equips, the second answered before the read the first started is rendered, end with the inventory not loading and showing the last read', async () => {
    const rowA = inventoryRow({
      inventory_id: 'ia',
      item_id: 'a',
      item: item({ item_id: 'a', name: 'Aurora' }),
    });
    const rowB = inventoryRow({
      inventory_id: 'ib',
      item_id: 'b',
      item: item({ item_id: 'b', name: 'Borealis' }),
    });
    const rows = { data: [rowA, rowB], next_cursor: null };
    const readAfterA = heldPromise<unknown>();
    const readAfterB = heldPromise<unknown>();
    mocks.inventory
      // The mount read and the Inventory tab's read.
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(rows)
      .mockReturnValueOnce(readAfterA.promise)
      .mockReturnValueOnce(readAfterB.promise);
    const answerA = heldPromise<unknown>();
    const answerB = heldPromise<unknown>();
    mocks.equip
      .mockReturnValueOnce(answerA.promise)
      .mockReturnValueOnce(answerB.promise);
    await act(async () => {
      renderForLoads();
    });
    await openTab('My Inventory');
    const toggle = (id: string) =>
      within(screen.getByTestId(`marketplace-inventory-row-${id}`)).getByTestId(
        'marketplace-inventory-equip-toggle',
      );
    await act(async () => {
      fireEvent.click(toggle('a'));
      fireEvent.click(toggle('b'));
    });
    expect(mocks.equip).toHaveBeenCalledTimes(2);
    // Both answers land in one turn, before React renders the read the
    // first one starts.
    await act(async () => {
      answerA.resolve(undefined);
      answerB.resolve(undefined);
    });
    expect(mocks.inventory).toHaveBeenCalledTimes(4);
    // The server equipped b alone: the last read says so.
    await act(async () => {
      readAfterB.resolve({
        data: [rowA, { ...rowB, equipped: true }],
        next_cursor: null,
      });
    });
    expect(screen.queryByTestId('marketplace-loading')).toBeNull();
    expect(toggle('a')).toHaveAttribute('aria-pressed', 'false');
    expect(toggle('b')).toHaveAttribute('aria-pressed', 'true');
    // The read the first answer started, superseded, writes nothing.
    await act(async () => {
      readAfterA.resolve(rows);
    });
    expect(toggle('b')).toHaveAttribute('aria-pressed', 'true');
    expect(toggle('a')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('MarketplacePage — an action keeps the visit it began in (R483.1)', () => {
  const cases = (['buy', 'equip'] as const).flatMap((action) =>
    (['succeeds', 'fails'] as const).map(
      (outcome) => [action, outcome] as const,
    ),
  );

  it.each(cases)(
    'a %s begun on the page that %s after the page has gone and come back shows nothing and reads nothing',
    async (action, outcome) => {
      const user = userEvent.setup();
      mocks.list.mockResolvedValue({
        data: [item({ price_tier_required: 'Starter' })],
        next_cursor: null,
      });
      mocks.inventory.mockResolvedValue({
        data: [
          inventoryRow({
            item_id: 'inv-1',
            equipped: false,
            item: item({ item_id: 'inv-1', name: 'Aurora Skin' }),
          }),
        ],
        next_cursor: null,
      });
      let settle!: (ok: boolean) => void;
      const answer = new Promise((resolve, reject) => {
        settle = (ok) =>
          ok
            ? resolve(inventoryRow({ item_id: 'inv-1', equipped: true }))
            : reject(new Error('boom'));
      });
      (action === 'buy' ? mocks.purchase : mocks.equip).mockReturnValue(answer);
      let first!: ReturnType<typeof render>;
      await act(async () => {
        first = renderPage();
      });
      if (action === 'buy') {
        const buy = await screen.findByRole('button', { name: 'Buy' });
        await act(async () => {
          fireEvent.click(buy);
        });
      } else {
        await user.click(
          await screen.findByRole('tab', { name: 'My Inventory' }),
        );
        const toggle = await screen.findByRole('button', { name: 'Equip' });
        await act(async () => {
          fireEvent.click(toggle);
        });
      }
      first.unmount();
      await act(async () => {
        renderPage();
      });
      const reads = mocks.inventory.mock.calls.length;
      mocks.addToast.mockClear();

      await act(async () => {
        settle(outcome === 'succeeds');
      });

      expect(mocks.addToast).not.toHaveBeenCalled();
      expect(mocks.inventory.mock.calls.length).toBe(reads);
    },
  );
});
