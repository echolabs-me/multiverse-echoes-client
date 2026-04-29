# Modding Guide — Multiverse Echoes Client

This document describes the modding architecture of the Multiverse Echoes open-source client. You can create custom themes, export templates, and extension panels without forking the client.

## Table of Contents

1. [Theme Overrides](#theme-overrides)
2. [Export Templates](#export-templates)
3. [Extension Slots](#extension-slots)
4. [Component Architecture](#component-architecture)
5. [API for Mods](#api-for-mods)

---

## Theme Overrides

The client uses CSS custom properties (defined in `src/styles/tokens.css`) for all visual styling. Themes work by overriding these properties.

### Built-in Palettes

- **Dark** (default) — warm dark palette per CDS-001 §3.1
- **Light** — inverted light palette per CDS-001 §3.2

### Creating a Custom Theme

A theme override extends one of the built-in palettes by replacing specific CSS tokens.

```typescript
import { useThemeStore } from './stores/useThemeStore';
import type { ThemeOverride } from './stores/useThemeStore';

const cyberpunkTheme: ThemeOverride = {
  id: 'cyberpunk-neon',
  name: 'Cyberpunk Neon',
  base: 'dark', // extends the dark palette
  tokens: {
    // Override any CSS custom property (without the leading --)
    'canvas': '#0a0014',
    'surface': '#140028',
    'surface-raised': '#1e003c',
    'accent': '#ff00ff',
    'accent-hover': '#ff44ff',
    'accent-subtle': '#1a0033',
    'border': '#3300aa',
  },
};

// Register at app startup or from a mod entry point
const store = useThemeStore.getState();
store.registerOverride(cyberpunkTheme);
```

### Available Token Names

All tokens from `src/styles/tokens.css` can be overridden:

| Token | Purpose | Example |
|-------|---------|---------|
| `canvas` | Page background | `#0f1923` |
| `surface` | Card/panel background | `#1a2633` |
| `surface-raised` | Elevated surface | `#243340` |
| `border` | Borders and dividers | `#2e4052` |
| `text-primary` | Primary text | `#e8e0d8` |
| `text-secondary` | Secondary text | `#9ba8b4` |
| `text-muted` | Muted/hint text | `#5e6f7e` |
| `accent` | Primary accent colour | `#d4915c` |
| `accent-hover` | Accent hover state | `#e0a574` |
| `accent-subtle` | Accent background tint | `#2a1f17` |
| `success` | Success indicators | `#6baf7a` |
| `warning` | Warning indicators | `#d4a84c` |
| `danger` | Error/danger indicators | `#c45b5b` |
| `info` | Info indicators | `#5b9ec4` |

Shard-specific accents (`accent-cyber-tokyo`, `accent-nomad-australia`, `accent-renaissance-florence`) can also be overridden.

### Theme Lifecycle

- Themes persist across sessions (stored in `localStorage` as `theme-override`)
- The user selects themes in **Settings > Appearance**
- Registered themes appear automatically in the theme picker
- Call `unregisterOverride(id)` to remove a theme

---

## Export Templates

The Story Export feature uses a template registry. Built-in templates ship with text, JSON, and timeline formats. Custom templates can be registered at runtime.

### Creating a Custom Export Template

```typescript
import { registerExportTemplate } from './lib/exportTemplates';
import type { ExportTemplate, ExportData } from './lib/exportTemplates';

const poetryTemplate: ExportTemplate = {
  id: 'my-mod-poetry',
  name: 'Poetry Format',
  description: 'Renders diary entries as verse stanzas.',
  format: 'text',
  builtin: false,
  render: (data: ExportData) => {
    const lines = [`~ ${data.echoName} ~\n`];
    for (const entry of data.diaryEntries) {
      lines.push(entry.content.replace(/\. /g, '.\n'));
      lines.push('---\n');
    }
    return lines.join('\n');
  },
};

registerExportTemplate(poetryTemplate);
```

### ExportData Shape

The `render` function receives:

```typescript
interface ExportData {
  echoName: string;
  whatIfPrompt: string;
  persona: string;
  diaryEntries: Array<{ tick: number; content: string; created_at: string }>;
  lifeEvents: Array<{ tick: number; event_type: string; description: string; created_at: string }>;
  relationships: Array<{ target_name: string; type: string; sentiment: number }>;
}
```

### Built-in Templates

| ID | Name | Format | Description |
|----|------|--------|-------------|
| `builtin-text` | Plain Text | text | Sections for diary, events, relationships |
| `builtin-json` | JSON | json | Machine-readable full export |
| `builtin-timeline` | Timeline | text | Chronological interleaving of events |

Built-in templates cannot be overridden or unregistered.

---

## Extension Slots

The client provides named "slots" where mods can inject React components into the UI.

### Available Slots

| Slot Name | Location | Context Props |
|-----------|----------|---------------|
| `dashboard-panel` | Below the main Echo panel on Dashboard | `echoId` |
| `echo-detail-panel` | Below built-in sections on Echo Detail | `echoId` |
| `shard-view-panel` | Below built-in sections on Shard View | `shardId` |
| `settings-tab` | Additional tabs in Settings | — |
| `sidebar-footer` | Bottom of the sidebar | — |

### Registering an Extension

```typescript
import { registerExtension } from './lib/extensions';
import type { ExtensionProps } from './lib/extensions';

function MyAnalyticsPanel({ echoId }: ExtensionProps) {
  // Your custom component — receives context from the host slot
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">Echo Analytics</h3>
      <p className="text-text-secondary">Showing data for {echoId}</p>
    </div>
  );
}

registerExtension('dashboard-panel', {
  id: 'my-mod-analytics',
  name: 'Echo Analytics',
  component: MyAnalyticsPanel,
});
```

### Using ExtensionSlot in Pages

The `<ExtensionSlot>` component renders all extensions for a given slot:

```tsx
import { ExtensionSlot } from './components/ExtensionSlot';

// In your page:
<ExtensionSlot slot="dashboard-panel" echoId={activeEchoId} />
```

Extensions render in registration order. If no extensions are registered, the slot renders nothing.

---

## Component Architecture

The client follows a flat component model. Understanding the structure helps modders know where to integrate.

### Directory Layout

```
client/src/
  components/       # Shared UI components (Button, Card, Modal, etc.)
    index.ts        # Barrel export — import from here
  pages/            # Route-level page components
  stores/           # Zustand state stores
  lib/
    api/            # Typed API client + endpoint functions
    ws/             # WebSocket client with reconnect
    extensions.ts   # Extension slot registry
    exportTemplates.ts  # Export template registry
    sounds.ts       # Notification sound system
  styles/
    tokens.css      # CSS custom properties (the theme layer)
    global.css      # Global styles + Tailwind @theme mapping
  types/
    api.ts          # TypeScript types matching engine responses
  locales/
    en.json         # i18n strings
```

### Key Patterns

1. **All colours come from CSS tokens** — never hardcode hex values. Use Tailwind utilities like `bg-canvas`, `text-accent`, `border-border`.

2. **State lives in Zustand stores** — `useAuthStore`, `useEchoStore`, `useShardStore`, etc. Mods can read from these stores.

3. **API calls go through `lib/api/endpoints.ts`** — typed functions for every engine endpoint.

4. **i18n via react-i18next** — all user-visible strings use `t('key')`. Mods should add keys to avoid hardcoded strings.

5. **Accessibility is required** — all interactive elements need ARIA attributes, keyboard navigation, and focus management. Use the existing components (Button, Modal, Input) as building blocks.

### Component Catalogue

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Button` | Action trigger | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger'` |
| `Card` | Content container | `variant: 'compact' \| 'standard' \| 'spacious'` |
| `Modal` | Dialog overlay | `open`, `onClose`, `title` |
| `Input` | Text input | `multiline`, `placeholder` |
| `Badge` | Status indicator | `variant` |
| `Tabs` | Tab navigation | `tabs`, `activeTab`, `onTabChange` |
| `Spinner` | Loading state | `size` |
| `EmptyState` | No-content placeholder | `title`, `description`, `action` |
| `Tooltip` | Hover information | `content` |
| `Dropdown` | Select menu | `options`, `onSelect` |
| `ExtensionSlot` | Mod injection point | `slot`, `echoId?`, `shardId?` |

---

## API for Mods

Mods communicate with the engine via the same REST API and WebSocket that the client uses.

### REST API

```typescript
import { echoes, feeds, shards } from './lib/api/endpoints';

// All functions are typed and handle auth automatically
const myEchoes = await echoes.list();
const feed = await feeds.personal();
```

### WebSocket

```typescript
import { createWebSocketClient } from './lib/ws/client';

// Subscribe to real-time events
const ws = createWebSocketClient(`/ws/echoes/${echoId}/stream`);
ws.onEvent((event) => {
  console.log('WorldEvent:', event);
});
```

### Authentication

Mods running inside the client share the user's auth session. Standalone tools should use API keys (created in Settings > API Keys).

---

## Guidelines

1. **Do not fork** — use the extension system instead. Forks diverge and miss updates.
2. **Respect the theme** — always use CSS token classes, never hardcode colours.
3. **Include AI disclaimers** — any exported or shared content must include the AI-generated content disclaimer.
4. **Follow accessibility standards** — WCAG 2.1 AA compliance is required for contributions.
5. **Keep it lightweight** — mods should not significantly increase bundle size or load time.
