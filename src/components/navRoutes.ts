/**
 * Zuordnung Pfad-Praefix -> Navigationspunkt.
 *
 * Die Hauptnavigation hat drei Punkte, die App aber mehr Routen: `/lists` und
 * `/celebrities` sind zwei Wege zu Eintraegen und muessen deshalb „Eintraege"
 * aktiv setzen. Als flache Tabelle ist die Zuordnung an einer Stelle sichtbar
 * und wird von Header und BottomNav gemeinsam benutzt.
 *
 * Reihenfolge egal — die Praefixe ueberschneiden sich nicht.
 */
const NAV_PREFIXES: ReadonlyArray<{ prefix: string; nav: string }> = [
  { prefix: '/play', nav: '/play' },
  { prefix: '/entries', nav: '/entries' },
  { prefix: '/lists', nav: '/entries' },
  { prefix: '/celebrities', nav: '/entries' },
  { prefix: '/history', nav: '/history' },
  { prefix: '/settings', nav: '/settings' },
];

/**
 * Der Navigationspunkt, der zu `pathname` gehoert — oder `null` auf der
 * Startseite, die bewusst keinen eigenen Punkt hat (das Logo fuehrt dorthin).
 */
export function activeNavHref(pathname: string): string | null {
  const match = NAV_PREFIXES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.nav ?? null;
}
