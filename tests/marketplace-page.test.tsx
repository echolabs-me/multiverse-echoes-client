import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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
  user: { subscription_tier: 'Starter' as string } as
    | { subscription_tier: string }
    | null,
}));

vi.mock('../src/stores/useToastStore.ts', () => ({
  useToastStore: (selector?: (s: unknown) => unknown) => {
    const state = { addToast: mocks.addToast };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../src/stores/useAuthStore.ts', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { user: mocks.user };
    return selector ? selector(state) : state;
  },
}));

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
    expect(screen.queryByRole('button', { name: 'Buy' })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: 'Buy' })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Buy' })).not.toBeInTheDocument();
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

    await waitFor(() => expect(mocks.equip).toHaveBeenCalledWith('inv-1', true));
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
      ),
    );
    // Button reverts to "Equip" (was optimistically "Unequip" mid-flight).
    expect(screen.getByRole('button', { name: 'Equip' })).toBeInTheDocument();
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
