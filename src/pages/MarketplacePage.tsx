import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Badge, EmptyState, Modal, Spinner, Tabs } from '../components/index.ts';
import { trackEvent } from '../lib/analytics.ts';
import { marketplace } from '../lib/api/endpoints.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import type {
  InventoryRowResponse,
  ItemRarity,
  MarketplaceCategory,
  MarketplaceItemResponse,
  MarketplacePreviewResponse,
  SubscriptionTier,
} from '../types/generated.ts';

// Spec §8.5 top-tab order. The `Uncategorized` sentinel from
// MarketplaceCategory is deliberately excluded — it is a migration
// artifact, never a tab the user should see (per Lane E Commit 2.5
// enum docstring). A row that surfaces `Uncategorized` post-backfill
// indicates a bug to investigate, not a tab to render.
const CATEGORY_TABS: ReadonlyArray<MarketplaceCategory> = [
  'DashboardTheme',
  'PortraitStyle',
  'ExportTemplate',
  'ShardAesthetic',
  'ScenarioPack',
  'SeasonalCosmetic',
  'SoundPack',
];

const INVENTORY_TAB_ID = 'myInventory';

function categoryTabLabelKey(c: MarketplaceCategory): string {
  // Map the PascalCase enum value to the camelCase i18n key half.
  // Keeping the explicit map (rather than a lowercase transform)
  // makes net-new categories surface as missing keys at lint time
  // instead of silently falling back to a generic label.
  switch (c) {
    case 'DashboardTheme':
      return 'marketplace.tabs.dashboardTheme';
    case 'PortraitStyle':
      return 'marketplace.tabs.portraitStyle';
    case 'ExportTemplate':
      return 'marketplace.tabs.exportTemplate';
    case 'ShardAesthetic':
      return 'marketplace.tabs.shardAesthetic';
    case 'ScenarioPack':
      return 'marketplace.tabs.scenarioPack';
    case 'SeasonalCosmetic':
      return 'marketplace.tabs.seasonalCosmetic';
    case 'SoundPack':
      return 'marketplace.tabs.soundPack';
    case 'Uncategorized':
      // Defensive: never rendered. Static lint won't catch the
      // unreachable arm without it (exhaustive switch).
      return 'marketplace.tabs.dashboardTheme';
  }
}

const RARITY_BADGE_VARIANT: Record<ItemRarity, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  Common: 'default',
  Rare: 'accent',
  Epic: 'warning',
  Legendary: 'danger',
};

function rarityLabelKey(r: ItemRarity): string {
  return `marketplace.rarity.${r.toLowerCase()}`;
}

function tierRank(t: SubscriptionTier): number {
  switch (t) {
    case 'Free':
      return 0;
    case 'Starter':
      return 1;
    case 'Core':
      return 2;
    case 'Creator':
      return 3;
    case 'GodMode':
      return 4;
  }
}

function tierMeets(user: SubscriptionTier, required: SubscriptionTier): boolean {
  return tierRank(user) >= tierRank(required);
}

function formatDuration(remainingMs: number): string {
  if (remainingMs <= 0) return '0s';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function CountdownTimer({ availableUntil }: { availableUntil: string }) {
  const target = useMemo(() => new Date(availableUntil).getTime(), [availableUntil]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, target - now);
  const { t } = useTranslation();
  return (
    <span className="text-xs text-text-muted">
      {t('marketplace.limitedTimeRemaining', { duration: formatDuration(remaining) })}
    </span>
  );
}

interface CardProps {
  item: MarketplaceItemResponse;
  ownedItemIds: Set<string>;
  userTier: SubscriptionTier | null;
  onPreview: (itemId: string) => void;
  onBuy: (itemId: string) => void;
}

function ItemCard({ item, ownedItemIds, userTier, onPreview, onBuy }: CardProps) {
  const { t } = useTranslation();
  const owned = ownedItemIds.has(item.item_id);
  const tierGate = userTier
    ? tierMeets(userTier, item.price_tier_required)
    : false;

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="size-16 rounded-md object-cover"
          />
        ) : (
          <div className="size-16 rounded-md bg-surface-raised" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-text-primary">{item.name}</h3>
            <Badge variant={RARITY_BADGE_VARIANT[item.rarity]}>
              {t(rarityLabelKey(item.rarity))}
            </Badge>
          </div>
          <p className="mbs-1 text-xs text-text-secondary">
            {t('marketplace.priceCoins', { count: item.price_coins })}
          </p>
          {item.price_tier_required !== 'Free' && (
            <p className="text-xs text-text-muted">
              {t('marketplace.tierRequired', { tier: item.price_tier_required })}
            </p>
          )}
          {item.is_limited_time && item.available_until && (
            <CountdownTimer availableUntil={item.available_until} />
          )}
        </div>
      </div>
      <div className="mbs-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPreview(item.item_id)}
          className="rounded-sm border border-border px-3 py-1 text-sm hover:bg-surface-raised"
        >
          {t('marketplace.preview')}
        </button>
        {owned ? (
          <span className="rounded-sm border border-border px-3 py-1 text-sm text-text-muted">
            {t('marketplace.owned')}
          </span>
        ) : tierGate ? (
          <button
            type="button"
            onClick={() => onBuy(item.item_id)}
            className="rounded-sm border border-accent px-3 py-1 text-sm text-accent hover:bg-accent-subtle"
          >
            {t('marketplace.buy')}
          </button>
        ) : (
          <Link
            to="/plans"
            className="rounded-sm border border-border px-3 py-1 text-sm hover:bg-surface-raised"
          >
            {t('marketplace.upgradeToUnlock')}
          </Link>
        )}
      </div>
    </article>
  );
}

interface InventoryRowProps {
  row: InventoryRowResponse;
  onToggle: (itemId: string, nextEquipped: boolean) => void;
}

function InventoryRow({ row, onToggle }: InventoryRowProps) {
  const { t } = useTranslation();
  if (!row.item) {
    return (
      <li className="rounded-sm border border-border p-3 text-sm text-text-muted">
        {row.item_id}
      </li>
    );
  }
  const item = row.item;
  return (
    <li className="flex items-center justify-between gap-3 rounded-sm border border-border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">{item.name}</span>
          <Badge variant={RARITY_BADGE_VARIANT[item.rarity]}>
            {t(rarityLabelKey(item.rarity))}
          </Badge>
        </div>
        <p className="mbs-1 text-xs text-text-muted">
          {t(categoryTabLabelKey(item.category))}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(item.item_id, !row.equipped)}
        aria-pressed={row.equipped}
        className="rounded-sm border border-border px-3 py-1 text-sm hover:bg-surface-raised"
      >
        {row.equipped ? t('marketplace.unequip') : t('marketplace.equip')}
      </button>
    </li>
  );
}

export function MarketplacePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [activeTabId, setActiveTabId] = useState<string>(CATEGORY_TABS[0]);
  const [items, setItems] = useState<MarketplaceItemResponse[]>([]);
  const [inventory, setInventory] = useState<InventoryRowResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    data: MarketplacePreviewResponse | null;
    name: string;
  }>({ open: false, data: null, name: '' });

  const ownedItemIds = useMemo(
    () => new Set(inventory.map((r) => r.item_id)),
    [inventory],
  );

  const loadCategory = useCallback(
    async (category: MarketplaceCategory) => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const page = await marketplace.list({ category });
        setItems(page.data);
      } catch {
        setItems([]);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const page = await marketplace.inventory();
      setInventory(page.data);
    } catch {
      setInventory([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTabId === INVENTORY_TAB_ID) {
      void loadInventory();
    } else {
      void loadCategory(activeTabId as MarketplaceCategory);
    }
  }, [activeTabId, loadCategory, loadInventory]);

  // Always hydrate inventory once on mount so item-grid cards can
  // render the "Owned" indicator on first paint of any category tab.
  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  // Fire the analytics browse event once per page mount.
  useEffect(() => {
    trackEvent('marketplace.browse', { category_filter: activeTabId });
    // Intentionally omit activeTabId from the dep array — we want
    // mount-only, not per-tab-switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreview = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.item_id === itemId);
      if (!item) return;
      try {
        const data = await marketplace.preview(itemId);
        setPreviewState({ open: true, data, name: item.name });
        trackEvent('marketplace.item_viewed', {
          item_id: itemId,
          category: item.category,
          price: item.price_coins,
        });
      } catch {
        addToast(t('marketplace.loadError'), 'danger');
      }
    },
    [items, addToast, t],
  );

  const handleBuy = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.item_id === itemId);
      if (!item) return;
      try {
        const row = await marketplace.purchase(itemId);
        setInventory((prev) => [row, ...prev.filter((r) => r.item_id !== row.item_id)]);
        trackEvent('marketplace.item_purchased', {
          item_id: itemId,
          category: item.category,
          price: item.price_coins,
          provider: 'tier_grant',
        });
      } catch {
        addToast(t('marketplace.loadError'), 'danger');
      }
    },
    [items, addToast, t],
  );

  const handleEquipToggle = useCallback(
    async (itemId: string, nextEquipped: boolean) => {
      const prior = inventory;
      // Optimistic update. The auto-unequip-others-of-same-type
      // logic lives server-side; the client cannot replicate it
      // accurately for non-Badge categories without re-fetching
      // the catalog metadata for every owned item. Instead of
      // attempting that, we re-fetch the inventory after the
      // server confirms — the truth flows back exactly once.
      setInventory((prev) =>
        prev.map((r) =>
          r.item_id === itemId ? { ...r, equipped: nextEquipped } : r,
        ),
      );
      try {
        await marketplace.equip(itemId, nextEquipped);
        await loadInventory();
      } catch {
        setInventory(prior);
        addToast(t('marketplace.equipError'), 'danger');
      }
    },
    [inventory, addToast, t, loadInventory],
  );

  const tabs = useMemo(() => {
    const categoryTabs = CATEGORY_TABS.map((c) => ({
      id: c,
      label: t(categoryTabLabelKey(c)),
    }));
    return [
      ...categoryTabs,
      { id: INVENTORY_TAB_ID, label: t('marketplace.tabs.myInventory') },
    ];
  }, [t]);

  const renderCategoryPanel = () => {
    if (isLoading) return <Spinner />;
    if (loadError) {
      return (
        <EmptyState
          title={t('marketplace.loadError')}
          action={
            <button
              type="button"
              onClick={() => void loadCategory(activeTabId as MarketplaceCategory)}
              className="rounded-sm border border-border px-3 py-1 hover:bg-surface-raised"
            >
              {t('common.retry')}
            </button>
          }
        />
      );
    }
    if (items.length === 0) {
      return <EmptyState title={t('marketplace.empty')} />;
    }
    return (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.item_id}>
            <ItemCard
              item={item}
              ownedItemIds={ownedItemIds}
              userTier={user?.subscription_tier ?? null}
              onPreview={handlePreview}
              onBuy={handleBuy}
            />
          </li>
        ))}
      </ul>
    );
  };

  const renderInventoryPanel = () => {
    if (isLoading) return <Spinner />;
    if (loadError) {
      return (
        <EmptyState
          title={t('marketplace.loadError')}
          action={
            <button
              type="button"
              onClick={() => void loadInventory()}
              className="rounded-sm border border-border px-3 py-1 hover:bg-surface-raised"
            >
              {t('common.retry')}
            </button>
          }
        />
      );
    }
    if (inventory.length === 0) {
      return <EmptyState title={t('marketplace.emptyInventory')} />;
    }
    return (
      <ul className="space-y-2">
        {inventory.map((row) => (
          <InventoryRow key={row.inventory_id} row={row} onToggle={handleEquipToggle} />
        ))}
      </ul>
    );
  };

  return (
    <main id="main-content" className="mx-auto max-w-5xl p-6">
      <header className="mbe-6">
        <h1 className="text-2xl font-bold">{t('marketplace.pageTitle')}</h1>
      </header>
      <Tabs
        tabs={tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          content:
            tab.id === activeTabId
              ? tab.id === INVENTORY_TAB_ID
                ? renderInventoryPanel()
                : renderCategoryPanel()
              : undefined,
        }))}
        activeTab={activeTabId}
        onTabChange={setActiveTabId}
      />
      <Modal
        open={previewState.open}
        onClose={() => setPreviewState({ open: false, data: null, name: '' })}
        title={previewState.name}
      >
        {previewState.data?.preview_image_url && (
          <img
            src={previewState.data.preview_image_url}
            alt={previewState.name}
            className="w-full rounded-md"
          />
        )}
      </Modal>
    </main>
  );
}
