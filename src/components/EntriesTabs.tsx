'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sub-Navigation der Eintraege-Ebene. Die drei Ziele bleiben eigenstaendige
 * Routen — die Tabs sind nur eine gemeinsame Leiste, die auf den jeweiligen
 * Uebersichtsseiten gerendert wird. Deep-Links bleiben damit intakt.
 */
const TABS = [
  { href: '/entries', label: 'Meine' },
  { href: '/lists', label: 'Listen' },
  { href: '/celebrities', label: 'Promis' },
] as const;

export function EntriesTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Eintraege" className="mb-6 inline-flex rounded-xl border border-line p-1">
      {TABS.map((tab) => {
        // `/lists/[id]` gehoert weiterhin zum Tab „Listen".
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-lg px-4 py-1.5 text-sm transition ${
              isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-dim hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
