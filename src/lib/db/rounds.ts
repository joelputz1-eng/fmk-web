import { newId, nowIso } from '@/lib/ids';
import { getDB } from './client';
import type { CardPosition, RoundItemRecord, RoundRecord, Verdict } from './schema';

export interface RoundAssignment {
  entryId: string;
  verdict: Verdict;
  position: CardPosition;
}

export interface SaveRoundInput {
  listId: string | null;
  poolDescriptor: string;
  assignments: RoundAssignment[];
}

export async function saveRound(input: SaveRoundInput): Promise<RoundRecord> {
  const db = await getDB();
  const round: RoundRecord = {
    id: newId(),
    listId: input.listId,
    poolDescriptor: input.poolDescriptor,
    playedAt: nowIso(),
  };

  const tx = db.transaction(['rounds', 'roundItems'], 'readwrite');
  void tx.objectStore('rounds').put(round);
  const itemStore = tx.objectStore('roundItems');
  for (const assignment of input.assignments) {
    const item: RoundItemRecord = {
      id: newId(),
      roundId: round.id,
      entryId: assignment.entryId,
      verdict: assignment.verdict,
      position: assignment.position,
    };
    void itemStore.put(item);
  }
  await tx.done;
  return round;
}

/** Neueste Runden zuerst. */
export async function listRounds(limit?: number): Promise<RoundRecord[]> {
  const db = await getDB();
  const rounds = await db.getAllFromIndex('rounds', 'by-playedAt');
  rounds.reverse();
  return limit ? rounds.slice(0, limit) : rounds;
}

export async function getRoundItems(roundId: string): Promise<RoundItemRecord[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('roundItems', 'by-round', roundId);
  return items.sort((a, b) => a.position - b.position);
}

export interface EntryPlayStats {
  shown: number;
  fuck: number;
  marry: number;
  kill: number;
}

/**
 * Stats werden nicht gespeichert, sondern abgeleitet (kein Denormalisierungs-Counter).
 * Wird in Phase 1 fuer die Sortierung "meist gespielt" gebraucht.
 */
export async function getEntryPlayStats(): Promise<Map<string, EntryPlayStats>> {
  const db = await getDB();
  const items = await db.getAll('roundItems');
  const stats = new Map<string, EntryPlayStats>();
  for (const item of items) {
    let entry = stats.get(item.entryId);
    if (!entry) {
      entry = { shown: 0, fuck: 0, marry: 0, kill: 0 };
      stats.set(item.entryId, entry);
    }
    entry.shown += 1;
    entry[item.verdict] += 1;
  }
  return stats;
}

export async function countRounds(): Promise<number> {
  const db = await getDB();
  return db.count('rounds');
}
