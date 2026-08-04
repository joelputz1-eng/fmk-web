import { personDetail, TmdbError } from './client';
import { isAllowed } from './safety';
import type { TmdbPersonDetail, TmdbPersonSummary } from './types';

/**
 * Der Haken an der Alterssicherung: /search/person und /person/popular liefern
 * kein birthday. Ohne Geburtsdatum koennen wir das Alter nicht pruefen, und
 * "unbekannt" gilt als "nicht erlaubt". Also muss jeder Kandidat erst per
 * /person/{id} angereichert werden — N+1 Requests pro Seite, gebaendigt durch
 * Parallelitaets-Limit und Prozess-Cache.
 */

/** Wieviele Detail-Requests gleichzeitig rausgehen. TMDB vertraegt das locker. */
const CONCURRENCY = 8;

const DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DETAIL_CACHE_MAX = 2000;

/**
 * Zweite Cache-Ebene neben Nexts fetch-Cache: die haelt auch dann, wenn der
 * Data-Cache umgangen wird, und dedupliziert Personen, die in mehreren Packs
 * bzw. auf mehreren Seiten auftauchen.
 */
const detailCache = new Map<number, { detail: TmdbPersonDetail; at: number }>();

function cacheGet(id: number): TmdbPersonDetail | null {
  const hit = detailCache.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > DETAIL_CACHE_TTL_MS) {
    detailCache.delete(id);
    return null;
  }
  return hit.detail;
}

function cacheSet(id: number, detail: TmdbPersonDetail): void {
  // Map haelt Einfuegereihenfolge — der aelteste Key fliegt zuerst raus.
  if (detailCache.size >= DETAIL_CACHE_MAX) {
    const oldest = detailCache.keys().next();
    if (!oldest.done) detailCache.delete(oldest.value);
  }
  detailCache.set(id, { detail, at: Date.now() });
}

async function loadDetail(id: number): Promise<TmdbPersonDetail> {
  const cached = cacheGet(id);
  if (cached) return cached;
  const detail = await personDetail(id);
  cacheSet(id, detail);
  return detail;
}

/** Fehler, bei denen Weitermachen sinnlos ist — die betreffen alle Requests. */
function isFatal(error: unknown): boolean {
  return (
    error instanceof TmdbError &&
    (error.code === 'missing_key' || error.code === 'unauthorized' || error.code === 'rate_limited')
  );
}

/**
 * Summaries → Details → Altersfilter. Die Reihenfolge der Eingabe bleibt
 * erhalten (TMDB sortiert nach Relevanz bzw. Popularitaet, das wollen wir
 * behalten).
 */
export async function enrichAndFilter(
  summaries: TmdbPersonSummary[],
  now: Date = new Date(),
): Promise<TmdbPersonDetail[]> {
  // Doppelte IDs kommen bei /search durchaus vor.
  const ids = [...new Set(summaries.map((person) => person.id))];
  const details = new Map<number, TmdbPersonDetail>();
  let firstError: unknown = null;

  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        details.set(id, await loadDetail(id));
      } catch (error) {
        if (isFatal(error)) throw error;
        // Einzelner Ausfall: die Person faellt raus, statt ungeprueft durchzurutschen.
        firstError ??= error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  // Kein einziges Detail durchgekommen → das war kein Einzelausfall.
  if (details.size === 0 && firstError) throw firstError;

  const result: TmdbPersonDetail[] = [];
  for (const id of ids) {
    const detail = details.get(id);
    if (detail && isAllowed(detail, now)) result.push(detail);
  }
  return result;
}
