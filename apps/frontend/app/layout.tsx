import './globals.css';
import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'All Minds',
  description: 'All Minds teacher support platform',
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
