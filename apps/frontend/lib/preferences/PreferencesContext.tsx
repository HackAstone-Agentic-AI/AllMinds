'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type TextScale = 'compact' | 'comfortable' | 'large';

interface Preferences {
  theme: ThemePreference;
  textScale: TextScale;
  highContrast: boolean;
  reducedMotion: boolean;
  readableFont: boolean;
}

interface PreferencesContextValue extends Preferences {
  setTheme: (theme: ThemePreference) => void;
  setTextScale: (scale: TextScale) => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setReadableFont: (enabled: boolean) => void;
  resetPreferences: () => void;
}

const STORAGE_KEY = 'allminds_preferences';

const defaults: Preferences = {
  theme: 'light',
  textScale: 'comfortable',
  highContrast: false,
  reducedMotion: false,
  readableFont: false,
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyPreferences(preferences: Preferences) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme =
    preferences.theme === 'auto' ? (systemDark ? 'dark' : 'light') : preferences.theme;

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preferences.theme;
  root.dataset.textScale = preferences.textScale;
  root.dataset.contrast = preferences.highContrast ? 'high' : 'standard';
  root.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
  root.dataset.readableFont = preferences.readableFont ? 'true' : 'false';
  root.style.colorScheme = resolvedTheme;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreferences({ ...defaults, ...JSON.parse(stored) });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    applyPreferences(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));

    if (preferences.theme !== 'auto') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => applyPreferences(preferences);
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, [preferences]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      setTheme: (theme) => setPreferences((current) => ({ ...current, theme })),
      setTextScale: (textScale) =>
        setPreferences((current) => ({ ...current, textScale })),
      setHighContrast: (highContrast) =>
        setPreferences((current) => ({ ...current, highContrast })),
      setReducedMotion: (reducedMotion) =>
        setPreferences((current) => ({ ...current, reducedMotion })),
      setReadableFont: (readableFont) =>
        setPreferences((current) => ({ ...current, readableFont })),
      resetPreferences: () => setPreferences(defaults),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return context;
}
