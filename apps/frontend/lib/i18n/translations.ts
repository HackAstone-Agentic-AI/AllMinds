export type LanguageCode =
  | 'en'
  | 'af'
  | 'zu'
  | 'xh'
  | 'nr'
  | 'nso'
  | 'st'
  | 'tn'
  | 'ss'
  | 've'
  | 'ts';

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa' },
  { code: 'nr', label: 'isiNdebele' },
  { code: 'nso', label: 'Sepedi' },
  { code: 'st', label: 'Sesotho' },
  { code: 'tn', label: 'Setswana' },
  { code: 'ss', label: 'siSwati' },
  { code: 've', label: 'Tshivenda' },
  { code: 'ts', label: 'Xitsonga' },
];

export type TranslationKey =
  | 'nav.home'
  | 'nav.tools'
  | 'nav.community'
  | 'nav.professionalDevelopment'
  | 'notifications.title'
  | 'notifications.empty';

type TranslationMap = Record<TranslationKey, string>;

// English is the base. All other languages use Partial<TranslationMap> — missing
// keys fall back to English automatically via the t() function in LanguageContext.
// To add a translation: replace the undefined entry with the translated string.
const en: TranslationMap = {
  'nav.home': 'Home',
  'nav.tools': 'Tools',
  'nav.community': 'Community',
  'nav.professionalDevelopment': 'Professional Development',
  'notifications.title': 'Notifications',
  'notifications.empty': 'No new notifications',
};

const af: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const zu: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const xh: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const nr: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const nso: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const st: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const tn: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const ss: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const ve: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

const ts: Partial<TranslationMap> = {
  // 'nav.home': '',
  // 'nav.tools': '',
  // 'nav.community': '',
  // 'nav.professionalDevelopment': '',
  // 'notifications.title': '',
  // 'notifications.empty': '',
};

export const translations: Record<LanguageCode, Partial<TranslationMap>> & { en: TranslationMap } = {
  en,
  af,
  zu,
  xh,
  nr,
  nso,
  st,
  tn,
  ss,
  ve,
  ts,
};
