import type { Metadata, Viewport } from 'next';
import { Anton, JetBrains_Mono, Manrope } from 'next/font/google';
import { BottomNav } from '@/components/BottomNav';
import { Nav } from '@/components/Nav';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
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
  manifest: '/manifest.webmanifest',
  // Gegenstueck zu src/app/robots.ts: die robots.txt bittet Crawler, gar nicht
  // erst zu lesen — diese Angabe gilt fuer die, die trotzdem lesen.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  /*
   * iOS liest das Manifest nicht. Ohne diese Angaben landet beim Hinzufuegen
   * zum Home-Bildschirm ein Screenshot der Seite auf dem Homescreen, und die
   * App startet im Safari-Chrome statt eigenstaendig.
   *
   * Auf dem Homescreen steht der Kurzname — das ist auch die unauffaelligere
   * Variante, wenn jemand anderes aufs Telefon schaut.
   */
  appleWebApp: {
    capable: true,
    title: 'FMK',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  // Ohne 'cover' liefert env(safe-area-inset-bottom) auf iOS konstant 0.
  viewportFit: 'cover',
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
        {/*
         * Next gibt ueber appleWebApp nur den standardisierten
         * `mobile-web-app-capable` aus. iOS vor 15.4 kennt nur die
         * Apple-Schreibweise und startet sonst trotz Manifest im
         * Safari-Chrome — eine Zeile Versicherung.
         */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <SettingsProvider>
          <div className="min-h-screen">
            <Nav />
            {/*
             * Unterhalb md liegt die BottomNav ueber dem Inhalt — der Abstand
             * haelt die letzte Zeile jeder Seite frei. Ab md gilt wieder der
             * bisherige Seitenabstand.
             */}
            <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-[calc(4.5rem_+_env(safe-area-inset-bottom))] md:pb-24">
              {children}
            </main>
            <BottomNav />
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
