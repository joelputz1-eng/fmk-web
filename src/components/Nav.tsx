'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/lib/theme/SettingsProvider';
import type { ThemePreference } from '@/lib/db/schema';

const LINKS = [
  { href: '/', label: 'Start' },
  { href: '/play', label: 'Spielen' },
  { href: '/entries', label: 'Einträge' },
  { href: '/lists', label: 'Listen' },
  { href: '/history', label: 'Verlauf' },
  { href: '/celebrities', label: 'Promis' },
  { href: '/settings', label: 'Einstellungen' },
] as const;

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system'];
const THEME_TITLE: Record<ThemePreference, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
};

/** Ab dieser Breite gibt es die Inline-Navigation statt des Off-Canvas-Menüs. */
const DESKTOP_QUERY = '(min-width: 768px)';

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  const paths: Record<ThemePreference, React.ReactNode> = {
    light: (
      <>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 2v1.5M10 16.5V18M18 10h-1.5M3.5 10H2M15.7 4.3l-1 1M5.3 14.7l-1 1M15.7 15.7l-1-1M5.3 5.3l-1-1" />
      </>
    ),
    dark: <path d="M16 11.5A6.5 6.5 0 018.5 4a6.5 6.5 0 107.5 7.5z" />,
    system: (
      <>
        <rect x="2.5" y="4" width="15" height="9.5" rx="1.5" />
        <path d="M7 17h6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      {paths[theme]}
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { settings, update } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Navigation schließt das Menü.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    // Beim Wechsel auf Desktop wird das Panel per CSS ausgeblendet — dann muss
    // auch der Scroll-Lock wieder weg.
    const desktop = matchMedia(DESKTOP_QUERY);
    const onBreakpointChange = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onBreakpointChange);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpointChange);
    };
  }, [menuOpen]);

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(settings.theme) + 1) % THEME_CYCLE.length];
    void update({ theme: next });
  };

  const iconButton =
    'rounded-xl border border-line p-2 text-dim transition hover:bg-surface-2 hover:text-ink';

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface-0/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4 px-4 py-3">
          <Link
            href="/"
            aria-label="Fuck Marry Kill — Start"
            className="display shrink-0 text-2xl leading-none"
          >
            <span className="text-fuck">F</span>
            <span className="text-marry">M</span>
            <span className="text-kill">K</span>
          </Link>

          <nav className="hidden flex-1 gap-0.5 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                className={`relative whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  isActive(pathname, link.href)
                    ? 'font-semibold text-ink'
                    : 'text-dim hover:text-ink'
                }`}
              >
                {link.label}
                {isActive(pathname, link.href) ? (
                  <span className="spine absolute inset-x-2.5 -bottom-0.5 rounded-full" />
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={cycleTheme}
              title={`Theme: ${THEME_TITLE[settings.theme]}`}
              aria-label={`Theme umschalten, aktuell ${THEME_TITLE[settings.theme]}`}
              className={iconButton}
            >
              <ThemeIcon theme={settings.theme} />
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menü öffnen"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className={`${iconButton} md:hidden`}
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="h-[18px] w-[18px]"
              >
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Off-Canvas-Menü — nur unterhalb des Desktop-Breakpoints. */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-40 md:hidden ${menuOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          tabIndex={menuOpen ? 0 : -1}
          aria-label="Menü schließen"
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          role="dialog"
          aria-modal={menuOpen}
          aria-label="Navigation"
          className={`absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-line bg-surface-1 transition-transform duration-200 ease-out ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="spine shrink-0" />

          <div className="flex items-center justify-between px-5 py-4">
            <span className="eyebrow">Menü</span>
            <button
              ref={closeButtonRef}
              type="button"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
              aria-label="Menü schließen"
              className={iconButton}
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="h-[18px] w-[18px]"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                tabIndex={menuOpen ? 0 : -1}
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                className={`display border-b border-line/60 px-2 py-3.5 text-2xl transition-colors ${
                  isActive(pathname, link.href) ? 'text-ink' : 'text-dim hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
