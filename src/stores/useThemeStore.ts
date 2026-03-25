import { create } from 'zustand';

/**
 * Theme override — a set of CSS custom property overrides applied on top of
 * the base dark or light palette. Marketplace themes (Phase 6) will use this
 * same structure.
 */
export interface ThemeOverride {
  /** Unique identifier (e.g. "cyberpunk-neon", "forest-green") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Which base palette this override extends */
  base: 'dark' | 'light';
  /** CSS custom property overrides (without the leading `--`). */
  tokens: Record<string, string>;
}

/** Built-in themes that ship with the client. */
const BUILTIN_THEMES: ThemeOverride[] = [];

export type ThemeBase = 'dark' | 'light';

interface ThemeState {
  /** Current base palette */
  base: ThemeBase;
  /** Currently applied theme override id, or null for stock palette */
  activeOverrideId: string | null;
  /** Registry of available theme overrides (built-in + user-registered) */
  overrides: ThemeOverride[];
  /** Set the base palette (dark or light) */
  setBase: (base: ThemeBase) => void;
  /** Toggle between dark and light base */
  toggleBase: () => void;
  /** Apply a theme override by id (null to clear) */
  applyOverride: (id: string | null) => void;
  /** Register a custom theme override */
  registerOverride: (override: ThemeOverride) => void;
  /** Unregister a custom theme override by id */
  unregisterOverride: (id: string) => void;

  /** Whether 3D environments and portraits are disabled */
  disable3D: boolean;
  /** Toggle 3D rendering on/off */
  setDisable3D: (disabled: boolean) => void;

  // Backwards-compatible aliases
  theme: ThemeBase;
  setTheme: (theme: ThemeBase) => void;
  toggleTheme: () => void;
}

const getStoredBase = (): ThemeBase => {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark'; // CDS-001 §2.1 — dark is the primary palette
};

const getStoredOverrideId = (): string | null => {
  return localStorage.getItem('theme-override') || null;
};

/** Apply CSS custom property overrides to the document root. */
const applyTokenOverrides = (tokens: Record<string, string>) => {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value);
  }
};

/** Clear all inline CSS custom property overrides. */
const clearTokenOverrides = () => {
  const root = document.documentElement;
  // Remove all inline style properties (they are the override layer)
  root.removeAttribute('style');
};

const applyTheme = (base: ThemeBase, override: ThemeOverride | null) => {
  document.documentElement.setAttribute('data-theme', base);
  localStorage.setItem('theme', base);

  clearTokenOverrides();

  if (override) {
    applyTokenOverrides(override.tokens);
    localStorage.setItem('theme-override', override.id);
  } else {
    localStorage.removeItem('theme-override');
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialBase = getStoredBase();
  const initialOverrideId = getStoredOverrideId();
  const allOverrides = [...BUILTIN_THEMES];

  const initialOverride = initialOverrideId
    ? allOverrides.find((o) => o.id === initialOverrideId) ?? null
    : null;

  applyTheme(initialBase, initialOverride);

  const initialDisable3D = localStorage.getItem('disable-3d') === 'true';

  return {
    base: initialBase,
    activeOverrideId: initialOverride?.id ?? null,
    overrides: allOverrides,
    disable3D: initialDisable3D,

    setBase: (base) => {
      const state = get();
      const override = state.activeOverrideId
        ? state.overrides.find((o) => o.id === state.activeOverrideId) ?? null
        : null;
      // If override targets a different base, clear it
      const effectiveOverride = override && override.base === base ? override : null;
      applyTheme(base, effectiveOverride);
      set({
        base,
        theme: base,
        activeOverrideId: effectiveOverride?.id ?? null,
      });
    },

    toggleBase: () => {
      const state = get();
      const next: ThemeBase = state.base === 'dark' ? 'light' : 'dark';
      state.setBase(next);
    },

    applyOverride: (id) => {
      const state = get();
      if (id === null) {
        applyTheme(state.base, null);
        set({ activeOverrideId: null });
        return;
      }
      const override = state.overrides.find((o) => o.id === id);
      if (!override) return;
      const base = override.base;
      applyTheme(base, override);
      set({ base, theme: base, activeOverrideId: id });
    },

    registerOverride: (override) => {
      set((state) => {
        // Prevent duplicates
        const filtered = state.overrides.filter((o) => o.id !== override.id);
        return { overrides: [...filtered, override] };
      });
    },

    unregisterOverride: (id) => {
      const state = get();
      set({
        overrides: state.overrides.filter((o) => o.id !== id),
        activeOverrideId: state.activeOverrideId === id ? null : state.activeOverrideId,
      });
      if (state.activeOverrideId === id) {
        applyTheme(state.base, null);
      }
    },

    setDisable3D: (disabled) => {
      localStorage.setItem('disable-3d', String(disabled));
      set({ disable3D: disabled });
    },

    // Backwards-compatible aliases
    theme: initialBase,
    setTheme: (theme) => {
      get().setBase(theme);
    },
    toggleTheme: () => {
      get().toggleBase();
    },
  };
});
