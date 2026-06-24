import './globals.css';
import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { PreferencesProvider } from '@/lib/preferences/PreferencesContext';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://allminds-frontend.onrender.com'
  ),
  title: {
    default: 'All Minds | Inclusive classroom intelligence',
    template: '%s | All Minds',
  },
  description:
    'AI-assisted planning, learner support, visual resources, scheduling, and family communication for inclusive classrooms.',
  openGraph: {
    title: 'All Minds | Inclusive classroom intelligence',
    description:
      'Plan, adapt, schedule, and communicate with inclusive classroom intelligence.',
    type: 'website',
    images: [
      {
        url: '/allminds-classroom-hero.png',
        width: 1536,
        height: 1024,
        alt: 'Teacher supporting learners in an inclusive classroom',
      },
    ],
  },
  icons: {
    icon: '/allminds-logo.png',
    apple: '/allminds-logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var raw = window.localStorage.getItem('allminds_preferences');
                  var preferences = raw ? JSON.parse(raw) : {};
                  var theme = preferences.theme || 'light';
                  var resolvedTheme = theme === 'auto'
                    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;

                  document.documentElement.dataset.theme = resolvedTheme;
                  document.documentElement.dataset.themePreference = theme;
                  document.documentElement.dataset.textScale = preferences.textScale || 'comfortable';
                  document.documentElement.dataset.contrast = preferences.highContrast ? 'high' : 'standard';
                  document.documentElement.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
                  document.documentElement.dataset.readableFont = preferences.readableFont ? 'true' : 'false';
                  document.documentElement.style.colorScheme = resolvedTheme;
                } catch (error) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <PreferencesProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
