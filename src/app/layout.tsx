import type { Metadata, Viewport } from 'next';
import { Anton, JetBrains_Mono, Manrope } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { SettingsProvider } from '@/lib/theme/SettingsProvider';
import { themeInitScript } from '@/lib/theme/themeScript';
import './globals.css';

/** Ultrakondensierte Versalien — sieht aus wie ein verkuendetes Urteil. */
const display = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

/** Fuer Zaehler, Rubriken und Statistiken — die App ist voller Zahlen. */
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fuck Marry Kill',
  description: 'Fuck Marry Kill — lokal im Browser, ohne Konto und ohne Server.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f2ed' },
    { media: '(prefers-color-scheme: dark)', color: '#140e1c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        {/* Muss vor dem ersten Paint laufen — IndexedDB ist async, sonst FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SettingsProvider>
          <div className="min-h-screen">
            <Nav />
            <main className="mx-auto w-full max-w-4xl px-4 py-8 pb-24">{children}</main>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
