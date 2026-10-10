import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';

import {
  Badge,
  EmptyState,
  Modal,
  Spinner,
  Tabs,
} from '../components/index.ts';
import { trackEvent } from '../lib/analytics.ts';
import { marketplace } from '../lib/api/endpoints.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useInFlight } from '../hooks/useInFlight.ts';
import {
  useCurrentKey,
  useLatestLoad,
  whenCurrent,
} from '../hooks/useCurrentKey.ts';
import { markers } from '../lib/inFlightMarkers.ts';
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

const RARITY_BADGE_VARIANT: Record<
  ItemRarity,
  'default' | 'accent' | 'success' | 'warning' | 'danger'
> = {
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

function tierMeets(
  user: SubscriptionTier,
  required: SubscriptionTier,
): boolean {
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
  const target = useMemo(
    () => new Date(availableUntil).getTime(),
    [availableUntil],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, target - now);
  const { t } = useTranslation();
  return (
    <span className="text-xs text-text-muted">
      {t('marketplace.limitedTimeRemaining', {
        duration: formatDuration(remaining),
      })}
    </span>
  );
}

interface CardProps {
  item: MarketplaceItemResponse;
  ownedItemIds: Set<string>;
  userTier: SubscriptionTier | null;
  onPreview: (itemId: string) => void;
  onBuy: (itemId: string) => void;
  /** The purchase of this item is in flight (R265). */
  busy: boolean;
}

function ItemCard({
  item,
  ownedItemIds,
  userTier,
  onPreview,
  onBuy,
  busy,
}: CardProps) {
  const { t } = useTranslation();
  const owned = ownedItemIds.has(item.item_id);
  const tierGate = userTier
    ? tierMeets(userTier, item.price_tier_required)
    : false;

  return (
    <article
      data-testid={`marketplace-item-card-${item.item_id}`}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="size-16 rounded-md object-cover"
          />
        ) : (
          <div
            className="size-16 rounded-md bg-surface-raised"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-text-primary">
              {item.name}
            </h3>
            <Badge variant={RARITY_BADGE_VARIANT[item.rarity]}>
              {t(rarityLabelKey(item.rarity))}
            </Badge>
          </div>
          <p className="mbs-1 text-xs text-text-secondary">
            {t('marketplace.priceCoins', { count: item.price_coins })}
          </p>
          {item.price_tier_required !== 'Free' && (
            <p className="text-xs text-text-muted">
              {t('marketplace.tierRequired', {
                tier: item.price_tier_required,
              })}
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
          data-testid="marketplace-item-preview"
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
            data-testid="marketplace-item-buy"
            disabled={busy}
            onClick={() => onBuy(item.item_id)}
            className="rounded-sm border border-accent px-3 py-1 text-sm text-accent hover:bg-accent-subtle"
          >
            {t('marketplace.buy')}
          </button>
        ) : (
          <Link
            to="/plans"
            data-testid="marketplace-item-buy-upgrade-link"
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
  /** The toggle's request is in flight, so a second click cannot send the
   *  opposite value (R265.3). */
  busy: boolean;
}

function InventoryRow({ row, onToggle, busy }: InventoryRowProps) {
  const { t } = useTranslation();
  if (!row.item) {
    return (
      <li
        data-testid={`marketplace-inventory-row-${row.item_id}`}
        className="rounded-sm border border-border p-3 text-sm text-text-muted"
      >
        {row.item_id}
      </li>
    );
  }
  const item = row.item;
  return (
    <li
      data-testid={`marketplace-inventory-row-${item.item_id}`}
      className="flex items-center justify-between gap-3 rounded-sm border border-border p-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {item.name}
          </span>
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
        data-testid="marketplace-inventory-equip-toggle"
        disabled={busy}
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
  // The catalog the last load read, and the category it was read for. It
  // is shown only while that category's tab is the active one (R371.1).
  const [catalog, setCatalog] = useState<{
    key: string;
    items: MarketplaceItemResponse[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const shownCatalog =
    catalog !== null && catalog.key === activeTabId ? catalog : null;
  const items = useMemo(() => shownCatalog?.items ?? [], [shownCatalog]);
  // The user's inventory, which belongs to no tab, with its own loading
  // state and error: a category's load never settles or fails the
  // inventory's, nor the inventory's a category's.
  const [inventory, setInventory] = useState<InventoryRowResponse[]>([]);
  const [inventoryLoad, setInventoryLoad] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: true, error: null });
  // Of the loads the page starts, only the last one started writes, and
  // only while the page is mounted (R361.1, R381.1): a category's only while
  // its tab is the active one, the inventory's whatever the tab. A purchase
  // or an equip supersedes the inventory's loads started before it when it
  // starts, so none undoes its write, and each starts a full read of the
  // inventory when it ends while the page is still mounted, answered or
  // failed, which supersedes every load started while it was pending and
  // ends the loading a superseded read began (R390.3b, R463.2); and a preview
  // is written only if it is the last one asked for, no dialog close has come
  // since it was asked for, and the page is mounted and still on the visit to
  // the tab it was asked on (R422.3, R434.1, R434.3): the preview's key is
  // the tab, so a tab change, back to the same tab included, ends it.
  const startCategory = useLatestLoad(activeTabId);
  const startInventory = useLatestLoad('inventory');
  const startPreview = useLatestLoad(activeTabId);
  // A purchase or an equip keeps the visit it began in, the page's mount:
  // answered after the page has gone, it shows nothing and reads nothing
  // (R483.1).
  const visitOf = useCurrentKey('inventory');
  const inFlight = useInFlight();
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    data: MarketplacePreviewResponse | null;
    name: string;
  }>({ open: false, data: null, name: '' });
  // Items whose purchase has been answered, shown as owned at once until
  // the inventory read the answer starts lands (R422.2).
  const [boughtItemIds, setBoughtItemIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const ownedItemIds = useMemo(
    () => new Set([...inventory.map((r) => r.item_id), ...boughtItemIds]),
    [inventory, boughtItemIds],
  );

  const loadCategory = useCallback(
    async (category: MarketplaceCategory) => {
      const isCurrent = startCategory(category);
      if (!isCurrent()) return;
      setCatalog({ key: category, items: [], loading: true, error: null });
      try {
        const page = await whenCurrent(
          isCurrent,
          marketplace.list({ category }),
        );
        setCatalog({
          key: category,
          items: page.data,
          loading: false,
          error: null,
        });
      } catch (err) {
        setCatalog({
          key: category,
          items: [],
          loading: false,
          error: translateCaughtError(err, t('marketplace.loadError')),
        });
      }
    },
    [t, startCategory],
  );

  const loadInventory = useCallback(async () => {
    const isCurrent = startInventory('inventory');
    if (!isCurrent()) return;
    setInventoryLoad({ loading: true, error: null });
    try {
      const page = await whenCurrent(isCurrent, marketplace.inventory());
      setInventory(page.data);
      setBoughtItemIds(new Set());
      setInventoryLoad({ loading: false, error: null });
    } catch (err) {
      setInventory([]);
      setInventoryLoad({
        loading: false,
        error: translateCaughtError(err, t('marketplace.loadError')),
      });
    }
  }, [t, startInventory]);

  useEffect(() => {
    void (async () => {
      if (activeTabId === INVENTORY_TAB_ID) {
        await loadInventory();
      } else {
        await loadCategory(activeTabId as MarketplaceCategory);
      }
    })();
  }, [activeTabId, loadCategory, loadInventory]);

  // Always hydrate inventory once on mount so item-grid cards can
  // render the "Owned" indicator on first paint of any category tab.
  useEffect(() => {
    void (async () => {
      await loadInventory();
    })();
  }, [loadInventory]);

  // Fire the analytics browse event once per page mount, with the
  // initial tab the user landed on. Ref-guarded so the hook can list
  // `activeTabId` in its deps (satisfying react-hooks/exhaustive-deps)
  // while still firing exactly once — the second invocation, after a
  // tab switch, finds `browseFiredRef.current === true` and returns
  // before re-emitting. This shape replaces an earlier
  // `eslint-disable-next-line react-hooks/exhaustive-deps` that
  // omitted `activeTabId` from the dep array.
  const browseFiredRef = useRef(false);
  useEffect(() => {
    if (browseFiredRef.current) return;
    browseFiredRef.current = true;
    trackEvent('marketplace.browse', { category_filter: activeTabId });
  }, [activeTabId]);

  const handlePreview = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.item_id === itemId);
      if (!item) return;
      const isCurrent = startPreview(activeTabId);
      try {
        const data = await whenCurrent(isCurrent, marketplace.preview(itemId));
        setPreviewState({ open: true, data, name: item.name });
        trackEvent('marketplace.item_viewed', {
          item_id: itemId,
          category: item.category,
          price: item.price_coins,
        });
      } catch (err) {
        addToast(
          translateCaughtError(err, t('marketplace.loadError')),
          'danger',
          { platformLink: isPlatformError(err) },
        );
      }
    },
    [items, addToast, t, startPreview, activeTabId],
  );

  // A tab change ends the preview asked for on the tab it leaves, so one
  // still pending opens nothing, on any tab or after a return to that one:
  // the preview's key is the tab, and a return is a new visit (R422.3,
  // R434.1, R434.3).
  const handleTabChange = useCallback(
    (id: string) => {
      if (id === activeTabId) return;
      setActiveTabId(id);
    },
    [activeTabId],
  );

  const handleBuy = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.item_id === itemId);
      if (!item) return;
      const inVisit = visitOf('inventory');
      await inFlight.run(markers.buy(itemId), async () => {
        // The purchase supersedes the inventory's loads started before it
        // (R390.3b). A read it supersedes never ends its loading, so the
        // read the purchase starts when it ends, answered or failed, does
        // (R463.2).
        startInventory('inventory');
        try {
          const row = await marketplace.purchase(itemId);
          trackEvent('marketplace.item_purchased', {
            item_id: itemId,
            category: item.category,
            price: item.price_coins,
            provider: 'tier_grant',
          });
          if (!inVisit()) return;
          // The bought item shows as owned at once, and the inventory is
          // read again: that read's answer replaces the list, and it
          // supersedes every inventory load started before it (R390.3b,
          // R422.2).
          setBoughtItemIds((prev) => new Set(prev).add(row.item_id));
          void loadInventory();
        } catch (err) {
          if (!inVisit()) return;
          addToast(
            translateCaughtError(err, t('marketplace.loadError')),
            'danger',
            { platformLink: isPlatformError(err) },
          );
          // The inventory is read again, as after a purchase.
          void loadInventory();
        }
      });
    },
    [items, addToast, t, inFlight, loadInventory, startInventory, visitOf],
  );

  const handleEquipToggle = useCallback(
    async (itemId: string, nextEquipped: boolean) => {
      const inVisit = visitOf('inventory');
      return inFlight.run(markers.equip(itemId), async () => {
        // Optimistic update. The auto-unequip-others-of-same-type
        // logic lives server-side; the client cannot replicate it
        // accurately for non-Badge categories without re-fetching
        // the catalog metadata for every owned item. Instead of
        // attempting that, we re-fetch the inventory after the
        // server confirms — the truth flows back exactly once.
        // The equip supersedes the inventory's loads started before it
        // (R390.3b); the reload after its answer is the newest write.
        startInventory('inventory');
        setInventory((prev) =>
          prev.map((r) =>
            r.item_id === itemId ? { ...r, equipped: nextEquipped } : r,
          ),
        );
        try {
          await marketplace.equip(itemId, nextEquipped);
          if (!inVisit()) return;
          // The equip's marker is released when its answer lands, not when
          // the reload does: a later load can supersede the reload, which
          // then never settles (R422.1).
          void loadInventory();
        } catch (err) {
          if (!inVisit()) return;
          addToast(
            translateCaughtError(err, t('marketplace.equipError')),
            'danger',
            { platformLink: isPlatformError(err) },
          );
          // An equip changes other items too, so a failure reads the
          // list again rather than restoring one taken before it: that
          // would undo another item's equip that succeeded meanwhile. A
          // failed reload shows as any failed load does (R285.3).
          void loadInventory();
        }
      });
    },
    [addToast, t, loadInventory, inFlight, startInventory, visitOf],
  );

  // Map enum value to kebab-case suffix for `marketplace-tab-{slug}`
  // testId. Matches the i18n-key half but in kebab-case so it reads
  // identically to other lane data-testids in the codebase.
  const categoryTabTestIdSlug = (c: MarketplaceCategory): string => {
    switch (c) {
      case 'DashboardTheme':
        return 'dashboard-theme';
      case 'PortraitStyle':
        return 'portrait-style';
      case 'ExportTemplate':
        return 'export-template';
      case 'ShardAesthetic':
        return 'shard-aesthetic';
      case 'ScenarioPack':
        return 'scenario-pack';
      case 'SeasonalCosmetic':
        return 'seasonal-cosmetic';
      case 'SoundPack':
        return 'sound-pack';
      case 'Uncategorized':
        return 'dashboard-theme';
    }
  };

  const tabs = useMemo(() => {
    const categoryTabs = CATEGORY_TABS.map((c) => ({
      id: c,
      label: t(categoryTabLabelKey(c)),
      testId: `marketplace-tab-${categoryTabTestIdSlug(c)}`,
    }));
    return [
      ...categoryTabs,
      {
        id: INVENTORY_TAB_ID,
        label: t('marketplace.tabs.myInventory'),
        testId: 'marketplace-tab-my-inventory',
      },
    ];
  }, [t]);

  const renderCategoryPanel = () => {
    if (shownCatalog === null || shownCatalog.loading) {
      return (
        <div data-testid="marketplace-loading">
          <Spinner />
        </div>
      );
    }
    if (shownCatalog.error) {
      return (
        <div data-testid="marketplace-load-error">
          <EmptyState
            title={shownCatalog.error}
            action={
              <button
                type="button"
                onClick={() =>
                  void loadCategory(activeTabId as MarketplaceCategory)
                }
                className="rounded-sm border border-border px-3 py-1 hover:bg-surface-raised"
              >
                {t('common.retry')}
              </button>
            }
          />
        </div>
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
              busy={inFlight.isHeld(markers.buy(item.item_id))}
            />
          </li>
        ))}
      </ul>
    );
  };

  const renderInventoryPanel = () => {
    if (inventoryLoad.loading) {
      return (
        <div data-testid="marketplace-loading">
          <Spinner />
        </div>
      );
    }
    if (inventoryLoad.error) {
      return (
        <div data-testid="marketplace-load-error">
          <EmptyState
            title={inventoryLoad.error}
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
        </div>
      );
    }
    if (inventory.length === 0) {
      return <EmptyState title={t('marketplace.emptyInventory')} />;
    }
    return (
      <ul className="space-y-2">
        {inventory.map((row) => (
          <InventoryRow
            key={row.inventory_id}
            row={row}
            onToggle={handleEquipToggle}
            busy={inFlight.isHeld(markers.equip(row.item_id))}
          />
        ))}
      </ul>
    );
  };

  return (
    <main
      id="main-content"
      data-testid="marketplace-page-root"
      className="mx-auto max-w-5xl p-6"
    >
      <header className="mbe-6">
        <h1 className="text-2xl font-bold">{t('marketplace.pageTitle')}</h1>
      </header>
      <div data-testid="marketplace-tabs-root">
        <Tabs
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            testId: tab.testId,
            content:
              tab.id === activeTabId
                ? tab.id === INVENTORY_TAB_ID
                  ? renderInventoryPanel()
                  : renderCategoryPanel()
                : undefined,
          }))}
          activeTab={activeTabId}
          onTabChange={handleTabChange}
        />
      </div>
      <Modal
        open={previewState.open}
        onClose={() => {
          // A preview still pending when the dialog closes opens nothing.
          startPreview(activeTabId);
          setPreviewState({ open: false, data: null, name: '' });
        }}
        title={previewState.name}
        closeTestId="marketplace-preview-modal-close"
      >
        <div data-testid="marketplace-preview-modal-root">
          {previewState.data?.preview_image_url && (
            <img
              src={previewState.data.preview_image_url}
              alt={previewState.name}
              className="w-full rounded-md"
            />
          )}
        </div>
      </Modal>
    </main>
  );
}
