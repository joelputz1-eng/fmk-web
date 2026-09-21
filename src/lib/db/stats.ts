import { getDB } from './client';
import { listEntries } from './entries';
import type { EntryRecord, RoundItemRecord, RoundRecord } from './schema';

/**
 * Lesezugriff fuer den Verlauf. Bewusst getrennt von rounds.ts, das schreibt
 * und einzelne Runden liest — hier geht es immer um den ganzen Bestand.
 */

export interface HistoryData {
  /** Neueste Runde zuerst. */
  rounds: RoundRecord[];
  /** Nur Items der oben enthaltenen Runden. */
  items: RoundItemRecord[];
  /** Inklusive soft-geloeschter — sonst stimmen die Summen nicht mehr. */
  entries: EntryRecord[];
}

/**
 * Laedt alles auf einmal und gruppiert im Speicher. Kein Index-Join pro Runde:
 * die Datenmengen sind klein (ein Nutzer, ein Browser), und der Schema-
 * Kommentar zieht diese Linie bereits bewusst.
 *
 * `listId === null` heisst "alle Runden", nicht "Runden ohne Liste".
 */
export async function loadHistory(listId: string | null = null): Promise<HistoryData> {
  const db = await getDB();
  const [allRounds, allItems, entries] = await Promise.all([
    db.getAllFromIndex('rounds', 'by-playedAt'),
    db.getAll('roundItems'),
    listEntries({ includeDeleted: true }),
  ]);
  allRounds.reverse();

  if (listId === null) return { rounds: allRounds, items: allItems, entries };

  const rounds = allRounds.filter((round) => round.listId === listId);
  const roundIds = new Set(rounds.map((round) => round.id));
  const items = allItems.filter((item) => roundIds.has(item.roundId));
  return { rounds, items, entries };
}

/** Items je Runde, innerhalb der Runde nach Kartenposition sortiert. */
export function groupItemsByRound(items: RoundItemRecord[]): Map<string, RoundItemRecord[]> {
  const byRound = new Map<string, RoundItemRecord[]>();
  for (const item of items) {
    const list = byRound.get(item.roundId);
    if (list) list.push(item);
    else byRound.set(item.roundId, [item]);
  }
  for (const list of byRound.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  return byRound;
}
