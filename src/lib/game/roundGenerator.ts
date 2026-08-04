/**
 * Rundengenerator (1.1): drei distinkte Entries aus dem Pool, kein Triple
 * wiederholt sich, bevor alle Kombinationen durch sind.
 *
 * Ein Triple wird als sortiertes ID-Tupel identifiziert — die Reihenfolge der
 * Karten auf dem Tisch ist fuer "schon gesehen" irrelevant.
 */

export type Triple = [string, string, string];

export function tripleKey(ids: readonly string[]): string {
  return [...ids].sort().join('|');
}

/** Anzahl moeglicher Triples = C(n, 3). */
export function totalTriples(poolSize: number): number {
  if (poolSize < 3) return 0;
  return (poolSize * (poolSize - 1) * (poolSize - 2)) / 6;
}

function sampleThree(ids: readonly string[]): Triple {
  const a = Math.floor(Math.random() * ids.length);
  let b = Math.floor(Math.random() * (ids.length - 1));
  if (b >= a) b += 1;
  const taken = [a, b].sort((x, y) => x - y);
  let c = Math.floor(Math.random() * (ids.length - 2));
  if (c >= taken[0]) c += 1;
  if (c >= taken[1]) c += 1;
  return [ids[a], ids[b], ids[c]];
}

/** Fisher-Yates auf einer Kopie — bestimmt die Kartenreihenfolge. */
function shuffle(triple: Triple): Triple {
  const result: Triple = [...triple];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface DrawResult {
  triple: Triple;
  key: string;
  /**
   * true = der Pool war erschoepft, die Used-Menge wurde zurueckgesetzt.
   * Der Aufrufer soll dann nur noch diesen Key als benutzt fuehren.
   */
  didReset: boolean;
}

const RANDOM_ATTEMPTS = 100;
const ENUMERATION_CAP = 200_000;

/**
 * Zieht ein noch nicht gespieltes Triple. Mutiert `used` nicht — der Aufrufer
 * entscheidet, wie er den zurueckgegebenen Key verbucht.
 */
export function drawTriple(poolIds: readonly string[], used: ReadonlySet<string>): DrawResult | null {
  if (poolIds.length < 3) return null;

  const total = totalTriples(poolIds.length);
  let didReset = false;
  let effectiveUsed: ReadonlySet<string> = used;
  if (used.size >= total) {
    effectiveUsed = new Set<string>();
    didReset = true;
  }

  // Solange der Pool duenn belegt ist, trifft Zufall praktisch immer sofort.
  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const triple = sampleThree(poolIds);
    const key = tripleKey(triple);
    if (!effectiveUsed.has(key)) return { triple: shuffle(triple), key, didReset };
  }

  // Dichte Belegung: deterministisch aufzaehlen statt endlos wuerfeln.
  if (total <= ENUMERATION_CAP) {
    const candidates: Triple[] = [];
    for (let i = 0; i < poolIds.length - 2; i += 1) {
      for (let j = i + 1; j < poolIds.length - 1; j += 1) {
        for (let k = j + 1; k < poolIds.length; k += 1) {
          const triple: Triple = [poolIds[i], poolIds[j], poolIds[k]];
          if (!effectiveUsed.has(tripleKey(triple))) candidates.push(triple);
        }
      }
    }
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      return { triple: shuffle(picked), key: tripleKey(picked), didReset };
    }
  }

  // Nichts Unbenutztes mehr uebrig — von vorn anfangen.
  const triple = sampleThree(poolIds);
  return { triple: shuffle(triple), key: tripleKey(triple), didReset: true };
}
