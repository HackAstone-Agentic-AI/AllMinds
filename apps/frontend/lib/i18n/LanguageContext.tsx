'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LanguageCode, TranslationKey, translations } from './translations';

const STORAGE_KEY = 'allminds_language';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (stored && stored in translations) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    localStorage.setItem(STORAGE_KEY, code);

    // Persist to backend if authenticated, so agents also receive the updated preference
    const token = localStorage.getItem('allminds_token');
    if (token) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      fetch(`${apiBase}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ language_pref: code }),
      }).catch(() => {
        // Persist failure is non-fatal — local state already updated
      });
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language]?.[key] ?? translations.en[key];
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
