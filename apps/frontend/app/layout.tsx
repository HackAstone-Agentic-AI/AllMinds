import './globals.css';
import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://allminds-frontend.onrender.com'
  ),
  title: 'All Minds',
  description: 'All Minds teacher support platform',
  icons: {
    icon: '/allminds-logo.png',
    apple: '/allminds-logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
