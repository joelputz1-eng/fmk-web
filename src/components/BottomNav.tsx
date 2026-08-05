'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeNavHref } from '@/components/navRoutes';

function DiceIcon() {
  return (
    <>
      <rect x="2.75" y="2.75" width="14.5" height="14.5" rx="3.5" />
      <path d="M6.75 6.75h.01M13.25 6.75h.01M10 10h.01M6.75 13.25h.01M13.25 13.25h.01" />
    </>
  );
}

function PeopleIcon() {
  return (
    <>
      <circle cx="8" cy="7" r="2.9" />
      <path d="M2.6 16.6a5.4 5.4 0 0110.8 0" />
      <path d="M13.4 4.5a2.9 2.9 0 010 5M14.6 12.1a5.4 5.4 0 012.8 4.5" />
    </>
  );
}

function ClockIcon() {
  return (
    <>
      <circle cx="10" cy="10" r="7.3" />
      <path d="M10 5.7V10l2.9 1.8" />
    </>
  );
}

const TABS = [
  { href: '/play', label: 'Spielen', Icon: DiceIcon },
  { href: '/entries', label: 'Einträge', Icon: PeopleIcon },
  { href: '/history', label: 'Verlauf', Icon: ClockIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // Im Spiel liegen die Aktionszonen ganz unten — eine Leiste darueber waere
  // eine Fehlklick-Falle, also raus damit.
  if (pathname === '/play') return null;

  const active = activeNavHref(pathname);

  return (
    <nav
      aria-label="Hauptnavigation"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-0/95 backdrop-blur md:hidden"
    >
      <ul className="flex">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = active === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 px-2 py-2.5 text-[0.7rem] transition-colors ${
                  isActive ? 'font-semibold text-ink' : 'text-dim'
                }`}
              >
                {/* Die Leiste sitzt oben an der Kachel — unten ist der Bildschirmrand. */}
                {isActive ? <span className="spine absolute inset-x-4 top-0 rounded-full" /> : null}
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <Icon />
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
