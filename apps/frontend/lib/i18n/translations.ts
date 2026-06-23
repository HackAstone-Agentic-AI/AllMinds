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
  // Navigation
  | 'nav.home'
  | 'nav.tools'
  | 'nav.community'
  | 'nav.professionalDevelopment'
  | 'nav.learnerAnalytics'
  // Notifications
  | 'notifications.title'
  | 'notifications.empty'
  // Sidebar / header
  | 'sidebar.settings'
  | 'sidebar.signOut'
  | 'sidebar.workspace'
  | 'sidebar.changeLanguage'
  // Dashboard home
  | 'dashboard.welcome'
  | 'dashboard.recentActivity'
  | 'dashboard.noActivity'
  | 'dashboard.lessonPlans'
  | 'dashboard.noLessonPlans'
  | 'dashboard.tasks'
  // Tools page
  | 'tools.title'
  | 'tools.subtitle'
  | 'tools.visualSupport'
  | 'tools.visualSupportDesc'
  | 'tools.assessmentPlanner'
  | 'tools.assessmentPlannerDesc'
  | 'tools.scheduleTracking'
  | 'tools.scheduleTrackingDesc'
  // Assessment planner
  | 'planner.title'
  | 'planner.subtitle'
  | 'planner.materialType'
  | 'planner.lessonPlan'
  | 'planner.worksheet'
  | 'planner.test'
  | 'planner.homework'
  | 'planner.subject'
  | 'planner.topic'
  | 'planner.grade'
  | 'planner.difficulty'
  | 'planner.foundation'
  | 'planner.intermediate'
  | 'planner.advanced'
  | 'planner.supportNeed'
  | 'planner.generate'
  | 'planner.generating'
  | 'planner.save'
  | 'planner.saving'
  | 'planner.saved'
  | 'planner.delete'
  | 'planner.generatedPlan'
  | 'planner.noplan'
  | 'planner.saveSuccess'
  | 'planner.videoResources'
  | 'planner.visualAids'
  // Common
  | 'common.loading'
  | 'common.error'
  | 'common.back'
  | 'common.export'
  | 'common.download';

type TranslationMap = Record<TranslationKey, string>;

// English is the complete base — all other languages use Partial<TranslationMap>
// and fall back to English for any missing key via the t() function.
const en: TranslationMap = {
  'nav.home': 'Home',
  'nav.tools': 'Tools',
  'nav.community': 'Community',
  'nav.professionalDevelopment': 'Professional Development',
  'nav.learnerAnalytics': 'Learner Analytics',
  'notifications.title': 'Notifications',
  'notifications.empty': 'No new notifications',
  'sidebar.settings': 'Settings',
  'sidebar.signOut': 'Sign out',
  'sidebar.workspace': 'All Minds workspace',
  'sidebar.changeLanguage': 'Change language',
  'dashboard.welcome': 'Welcome back',
  'dashboard.recentActivity': 'Recent Activity',
  'dashboard.noActivity': 'No recent activity yet.',
  'dashboard.lessonPlans': 'Lesson Plans',
  'dashboard.noLessonPlans': 'No lesson plans saved yet.',
  'dashboard.tasks': 'Tasks',
  'tools.title': 'Teaching Tools',
  'tools.subtitle': 'AI-powered tools for inclusive, neurodivergent-affirming classrooms',
  'tools.visualSupport': 'Visual Support',
  'tools.visualSupportDesc': 'Build simple visual supports for neurodiverse learners',
  'tools.assessmentPlanner': 'Assessment & Pedagogical Planner',
  'tools.assessmentPlannerDesc': 'Generate inclusive lesson plans, worksheets, tests, and homework',
  'tools.scheduleTracking': 'Schedule & Tracking',
  'tools.scheduleTrackingDesc': 'Create visual schedules and track learner progress',
  'planner.title': 'Assessment & Pedagogical Planner',
  'planner.subtitle': 'Generate inclusive plans with YouTube resources and AI visual aids',
  'planner.materialType': 'Material Type',
  'planner.lessonPlan': 'Lesson Plan',
  'planner.worksheet': 'Worksheet',
  'planner.test': 'Test',
  'planner.homework': 'Homework',
  'planner.subject': 'Subject',
  'planner.topic': 'Topic',
  'planner.grade': 'Grade',
  'planner.difficulty': 'Difficulty Level',
  'planner.foundation': 'Foundation',
  'planner.intermediate': 'Intermediate',
  'planner.advanced': 'Advanced',
  'planner.supportNeed': 'Specific Support Need',
  'planner.generate': 'Generate',
  'planner.generating': 'Generating…',
  'planner.save': 'Save Plan',
  'planner.saving': 'Saving…',
  'planner.saved': 'Saved',
  'planner.delete': 'Delete',
  'planner.generatedPlan': 'Generated Plan',
  'planner.noplan': 'No plan generated yet',
  'planner.saveSuccess': 'Plan saved. It will appear in Lesson Plans on your dashboard.',
  'planner.videoResources': 'Video Resources',
  'planner.visualAids': 'AI Visual Aids',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong. Please try again.',
  'common.back': 'Back',
  'common.export': 'Export',
  'common.download': 'Download',
};

const af: Partial<TranslationMap> = {
  'nav.home': 'Tuis',
  'nav.tools': 'Gereedskap',
  'nav.community': 'Gemeenskap',
  'nav.professionalDevelopment': 'Professionele Ontwikkeling',
  'nav.learnerAnalytics': 'Leerderanalise',
  'notifications.title': 'Kennisgewings',
  'notifications.empty': 'Geen nuwe kennisgewings',
  'sidebar.settings': 'Instellings',
  'sidebar.signOut': 'Teken uit',
  'sidebar.workspace': 'All Minds werkspasie',
  'sidebar.changeLanguage': 'Verander taal',
  'planner.title': 'Assessering- en Pedagogiese Beplanner',
  'planner.subtitle': 'Genereer inklusiewe planne met YouTube-hulpbronne en KI-visuele hulpmiddels',
  'planner.materialType': 'Materiaal Tipe',
  'planner.lessonPlan': 'Lesplan',
  'planner.worksheet': 'Werkblad',
  'planner.test': 'Toets',
  'planner.homework': 'Huiswerk',
  'planner.subject': 'Vak',
  'planner.topic': 'Onderwerp',
  'planner.grade': 'Graad',
  'planner.difficulty': 'Moeilikheidsgraad',
  'planner.foundation': 'Fondament',
  'planner.intermediate': 'Intermediêr',
  'planner.advanced': 'Gevorderd',
  'planner.generate': 'Genereer',
  'planner.generating': 'Besig om te genereer…',
  'planner.save': 'Stoor Plan',
  'planner.saving': 'Besig om te stoor…',
  'planner.saved': 'Gestoor',
  'planner.delete': 'Verwyder',
  'common.loading': 'Laai…',
  'common.back': 'Terug',
  'common.download': 'Aflaai',
};

const zu: Partial<TranslationMap> = {
  'nav.home': 'Ikhaya',
  'nav.tools': 'Amathuluzi',
  'nav.community': 'Umphakathi',
  'nav.professionalDevelopment': 'Ukuthuthukiswa Komsebenzi',
  'nav.learnerAnalytics': 'Ukuhlaziya Abafundi',
  'notifications.title': 'Izaziso',
  'notifications.empty': 'Azikho izaziso ezintsha',
  'sidebar.settings': 'Izilungiselelo',
  'sidebar.signOut': 'Phuma',
  'planner.lessonPlan': 'Uhlelo Lwesifundo',
  'planner.worksheet': 'Ishidi Lomsebenzi',
  'planner.test': 'Uhlelo',
  'planner.homework': 'Umsebenzi Wasekhaya',
  'planner.subject': 'Isifundo',
  'planner.topic': 'Isihloko',
  'planner.grade': 'Ibanga',
  'common.loading': 'Iyalayisha…',
  'common.back': 'Emuva',
};

const xh: Partial<TranslationMap> = {
  'nav.home': 'Ikhaya',
  'nav.tools': 'Izixhobo',
  'nav.community': 'Uluntu',
  'nav.professionalDevelopment': 'Uphuhliso Lomsebenzi',
  'nav.learnerAnalytics': 'Uhlalutyo Lwabafundi',
  'notifications.title': 'Izaziso',
  'notifications.empty': 'Akukho zaziso zintsha',
  'sidebar.settings': 'Iisetingi',
  'sidebar.signOut': 'Phuma',
  'planner.lessonPlan': 'Icebo Lesifundo',
  'planner.subject': 'Isifundo',
  'planner.topic': 'Isihloko',
  'planner.grade': 'Ibanga',
  'common.loading': 'Iyalayisha…',
  'common.back': 'Emuva',
};

// Other languages — English fallback applies for any missing key
const nr: Partial<TranslationMap> = {};
const nso: Partial<TranslationMap> = {};
const st: Partial<TranslationMap> = {};
const tn: Partial<TranslationMap> = {};
const ss: Partial<TranslationMap> = {};
const ve: Partial<TranslationMap> = {};
const ts: Partial<TranslationMap> = {};

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
