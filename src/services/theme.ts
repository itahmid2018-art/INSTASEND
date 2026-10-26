import { useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'instasend_theme';

/**
 * Returns the current OS / system color scheme preference.
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Resolves the given theme mode (or stored theme) to 'light' or 'dark'.
 */
export function getResolvedTheme(mode?: ThemeMode): 'light' | 'dark' {
  const currentMode = mode || getStoredTheme();
  if (currentMode === 'system') {
    return getSystemTheme();
  }
  return currentMode;
}

/**
 * Gets the user's stored theme preference from localStorage, defaulting to 'system'.
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage quota or security errors
  }
  return 'system';
}

/**
 * Applies the resolved theme class to document.documentElement and saves the preference.
 */
export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }

  const resolved = getResolvedTheme(mode);
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }

  // Update meta theme-color tag for mobile status bar
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#202124' : '#1a73e8');
  }

  // Dispatch custom event for cross-tab or cross-component reactivity
  window.dispatchEvent(new CustomEvent('instasend-theme-change', { 
    detail: { theme: mode, resolvedTheme: resolved } 
  }));

  return resolved;
}

/**
 * React hook to manage and observe theme state.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getResolvedTheme(getStoredTheme()));

  useEffect(() => {
    // Initial sync
    const resolved = applyTheme(theme);
    setResolvedTheme(resolved);

    // Listen for system preference changes (e.g. sunset/sunrise or OS toggle)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        const currentStored = getStoredTheme();
        if (currentStored === 'system') {
          const newResolved = applyTheme('system');
          setResolvedTheme(newResolved);
        }
      };

      mediaQuery.addEventListener('change', handleMediaChange);

      // Listen for custom theme change events
      const handleCustomEvent = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail) {
          setThemeState(detail.theme);
          setResolvedTheme(detail.resolvedTheme);
        }
      };
      window.addEventListener('instasend-theme-change', handleCustomEvent);

      return () => {
        mediaQuery.removeEventListener('change', handleMediaChange);
        window.removeEventListener('instasend-theme-change', handleCustomEvent);
      };
    }
  }, [theme]);

  const setTheme = (newMode: ThemeMode) => {
    setThemeState(newMode);
    const resolved = applyTheme(newMode);
    setResolvedTheme(resolved);
  };

  const toggleDarkMode = () => {
    // Seamless toggle: if currently dark -> switch to light, if light -> switch to dark
    const nextMode: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextMode);
  };

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    isSystem: theme === 'system',
    setTheme,
    toggleDarkMode,
  };
}
