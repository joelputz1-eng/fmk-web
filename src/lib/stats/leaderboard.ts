import type { EntryRecord, RoundItemRecord, Verdict } from '../db/schema';

/**
 * Auswertung der gespielten Runden (FEATURES.md 6.1/6.2).
 *
 * Wie src/lib/tmdb/safety.ts bewusst ohne IndexedDB, ohne Netz und ohne
 * Laufzeit-Imports: die Rangregel ist der Teil, der falsch werden kann, und
 * muss mit Fixtures pruefbar bleiben (tests/leaderboard.test.ts).
 */

/**
 * Unterhalb dieser Auftrittszahl wird nicht gerankt. Sonst gewinnt jeder, der
 * einmal gezogen und einmal geheiratet wurde, mit 100 %.
 */
export const MIN_APPEARANCES = 3;

/**
 * Reihenfolge der Urteile in Balken und Aufschluesselung. VERDICTS aus
 * schema.ts wird absichtlich nicht importiert — diese Datei bleibt frei von
 * Laufzeit-Imports, damit der Test sie ohne Bundler laden kann.
 */
export const VERDICT_ORDER: readonly Verdict[] = ['fuck', 'marry', 'kill'];

export interface EntryStats {
  entryId: string;
  name: string;
  photoBlobId?: string;
  /** Soft-geloescht: zaehlt weiter mit, wird in der UI nur markiert. */
  isDeleted: boolean;
  appearances: number;
  counts: Record<Verdict, number>;
  /** Anteil des Urteils an den eigenen Auftritten, 0..1. */
  shares: Record<Verdict, number>;
}

function zeroCounts(): Record<Verdict, number> {
  return { fuck: 0, marry: 0, kill: 0 };
}

/**
 * Gleichstand deterministisch aufloesen: Name, dann ID. Ohne die ID koennten
 * zwei Namensgleiche bei jedem Rendern die Plaetze tauschen.
 */
function compareIdentity(a: EntryStats, b: EntryStats): number {
  const byName = a.name.localeCompare(b.name, 'de');
  return byName !== 0 ? byName : a.entryId.localeCompare(b.entryId);
}

/**
 * Zaehlt Auftritte und Urteile je Eintrag. Eintraege ohne Auftritt tauchen
 * nicht auf — wer nie gespielt wurde, wird auch nicht bewertet.
 */
export function buildStats(items: RoundItemRecord[], entries: EntryRecord[]): EntryStats[] {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const byEntry = new Map<string, EntryStats>();

  for (const item of items) {
    const entry = entryById.get(item.entryId);
    // Kein Eintrag mehr da: ohne Namen ist die Zeile nicht darstellbar.
    // Sollte nicht vorkommen, weil Loeschen nur soft ist.
    if (!entry) continue;

    let stats = byEntry.get(entry.id);
    if (!stats) {
      stats = {
        entryId: entry.id,
        name: entry.name,
        photoBlobId: entry.photoBlobId,
        isDeleted: entry.deletedAt !== null,
        appearances: 0,
        counts: zeroCounts(),
        shares: zeroCounts(),
      };
      byEntry.set(entry.id, stats);
    }
    stats.appearances += 1;
    stats.counts[item.verdict] += 1;
  }

  const all = [...byEntry.values()];
  for (const stats of all) {
    for (const verdict of VERDICT_ORDER) {
      stats.shares[verdict] = stats.counts[verdict] / stats.appearances;
    }
  }
  return all.sort(compareIdentity);
}

/**
 * Rangliste fuer ein Urteil. Sortiert nach Quote, nicht nach absoluter Zahl:
 * absolute Zaehler messen Anwesenheit, nicht Beliebtheit. Bei Gleichstand
 * entscheidet die absolute Zahl, danach der Name.
 *
 * Eintraege mit Quote 0 bleiben drin — die volle Tabelle soll unabhaengig vom
 * gewaehlten Urteil dieselben Zeilen zeigen; sie rutschen ans Ende.
 */
export function rankBy(
  stats: EntryStats[],
  verdict: Verdict,
  minAppearances: number = MIN_APPEARANCES,
): EntryStats[] {
  return stats
    .filter((entry) => entry.appearances >= minAppearances)
    .sort((a, b) => {
      if (b.shares[verdict] !== a.shares[verdict]) return b.shares[verdict] - a.shares[verdict];
      if (b.counts[verdict] !== a.counts[verdict]) return b.counts[verdict] - a.counts[verdict];
      return compareIdentity(a, b);
    });
}

/** Oft gezogen, kein einziges Marry. Der mit den meisten Auftritten gewinnt. */
export function findNeverMarried(
  stats: EntryStats[],
  minAppearances: number = MIN_APPEARANCES,
): EntryStats | null {
  const candidates = stats.filter(
    (entry) => entry.appearances >= minAppearances && entry.counts.marry === 0,
  );
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => b.appearances - a.appearances || compareIdentity(a, b),
  )[0];
}

/** Abstand zur Gleichverteilung. 0 = exakt ein Drittel je Urteil. */
function evennessGap(stats: EntryStats): number {
  return VERDICT_ORDER.reduce((sum, verdict) => sum + Math.abs(stats.shares[verdict] - 1 / 3), 0);
}

/**
 * Polarisierend heisst: moeglichst gleichmaessig ueber alle drei Urteile.
 * Voraussetzung ist, dass jedes Urteil mindestens einmal vorkommt — wer nur
 * gekillt wurde, ist das Gegenteil von polarisierend, nicht das Extrem davon.
 */
export function findMostPolarising(
  stats: EntryStats[],
  minAppearances: number = MIN_APPEARANCES,
): EntryStats | null {
  const candidates = stats.filter(
    (entry) =>
      entry.appearances >= minAppearances &&
      VERDICT_ORDER.every((verdict) => entry.counts[verdict] > 0),
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    const gap = evennessGap(a) - evennessGap(b);
    // Fliesskomma: knappe Unterschiede gelten als Gleichstand.
    if (Math.abs(gap) > 1e-9) return gap;
    return b.appearances - a.appearances || compareIdentity(a, b);
  })[0];
}

/** "4 von 5 · 80 %" — eine Quote ohne ihre Grundgesamtheit ist nicht nachvollziehbar. */
export function formatShare(count: number, appearances: number): string {
  const percent = appearances === 0 ? 0 : Math.round((count / appearances) * 100);
  return `${count} von ${appearances} · ${percent} %`;
}
