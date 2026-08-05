'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSettings } from '@/lib/theme/SettingsProvider';
import type { ThemePreference } from '@/lib/db/schema';
import { activeNavHref } from '@/components/navRoutes';

const LINKS = [
  { href: '/play', label: 'Spielen' },
  { href: '/entries', label: 'Einträge' },
  { href: '/history', label: 'Verlauf' },
] as const;

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system'];
const THEME_TITLE: Record<ThemePreference, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
};

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

function GearIcon() {
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
      <path d="M8.67 2.01A8.1 8.1 0 0 1 11.33 2.01L11.35 3.95A6.2 6.2 0 0 1 13.32 4.77L14.71 3.41A8.1 8.1 0 0 1 16.59 5.29L15.23 6.68A6.2 6.2 0 0 1 16.05 8.65L17.99 8.67A8.1 8.1 0 0 1 17.99 11.33L16.05 11.35A6.2 6.2 0 0 1 15.23 13.32L16.59 14.71A8.1 8.1 0 0 1 14.71 16.59L13.32 15.23A6.2 6.2 0 0 1 11.35 16.05L11.33 17.99A8.1 8.1 0 0 1 8.67 17.99L8.65 16.05A6.2 6.2 0 0 1 6.68 15.23L5.29 16.59A8.1 8.1 0 0 1 3.41 14.71L4.77 13.32A6.2 6.2 0 0 1 3.95 11.35L2.01 11.33A8.1 8.1 0 0 1 2.01 8.67L3.95 8.65A6.2 6.2 0 0 1 4.77 6.68L3.41 5.29A8.1 8.1 0 0 1 5.29 3.41L6.68 4.77A6.2 6.2 0 0 1 8.65 3.95L8.67 2.01Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { settings, update } = useSettings();
  const active = activeNavHref(pathname);

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(settings.theme) + 1) % THEME_CYCLE.length];
    void update({ theme: next });
  };

  const iconButton =
    'rounded-xl border border-line p-2 text-dim transition hover:bg-surface-2 hover:text-ink';

  return (
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

        {/* Unterhalb md uebernimmt die BottomNav — hier waere kein Platz. */}
        <nav aria-label="Hauptnavigation" className="hidden flex-1 gap-0.5 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active === link.href ? 'page' : undefined}
              className={`relative whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                active === link.href ? 'font-semibold text-ink' : 'text-dim hover:text-ink'
              }`}
            >
              {link.label}
              {active === link.href ? (
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

          <Link
            href="/settings"
            aria-label="Einstellungen"
            aria-current={active === '/settings' ? 'page' : undefined}
            className={`${iconButton} ${active === '/settings' ? 'bg-surface-2 text-ink' : ''}`}
          >
            <GearIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
