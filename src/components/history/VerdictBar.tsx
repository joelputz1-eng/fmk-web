import { VERDICT_THEME } from '@/components/game/verdictTheme';
import { VERDICT_ORDER, formatShare, type EntryStats } from '@/lib/stats/leaderboard';
import type { Verdict } from '@/lib/db/schema';

/**
 * Die Verteilung der drei Urteile als gestapelter Balken — drei Div mit
 * Prozentbreiten, keine Chart-Bibliothek.
 *
 * Der Balken ist fuer Screenreader unsichtbar; die Zahlen stehen daneben als
 * Text. Eine Grafik, in der die Werte nur als Breite stecken, ist sonst fuer
 * niemanden lesbar, der sie nicht sieht.
 */
export function VerdictBar({
  stats,
  labels,
  className = '',
}: {
  stats: EntryStats;
  labels: Record<Verdict, string>;
  className?: string;
}) {
  return (
    <div className={className}>
      <div aria-hidden className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {VERDICT_ORDER.map((verdict) =>
          stats.counts[verdict] > 0 ? (
            <div
              key={verdict}
              className={VERDICT_THEME[verdict].solid}
              style={{ width: `${stats.shares[verdict] * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="sr-only">
        {VERDICT_ORDER.map(
          (verdict) =>
            `${labels[verdict]}: ${formatShare(stats.counts[verdict], stats.appearances)}`,
        ).join('. ')}
      </p>
    </div>
  );
}
