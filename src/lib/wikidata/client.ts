import { categoryForOccupations } from './occupations';

/**
 * Wikidata-Zugriff fuer den Kategorie-Vorschlag. Ausschliesslich serverseitig,
 * gleicher Aufbau wie tmdb/client.ts.
 *
 * Wikidata braucht keinen Key und keinen Account, die Daten sind CC0. TMDB
 * bleibt Quelle fuer Name, Foto und Geburtsdatum — Wikidata beantwortet
 * ausschliesslich "welchen Beruf hat diese Person".
 *
 * Nichts hier darf den Import blockieren: jeder Fehler endet in "kein
 * Vorschlag". Deshalb wirft dieses Modul nach aussen nicht.
 */

/**
 * Der schlanke Claim-Endpunkt statt Special:EntityData/{Q}.json — letzterer
 * liefert das komplette Entity-Dokument (haeufig > 1 MB) fuer einen Beruf.
 */
const BASE_URL = 'https://www.wikidata.org/w/api.php';

/**
 * Wikimedia verlangt einen aussagekraeftigen User-Agent mit Projektname und
 * Kontaktmoeglichkeit — ohne den drohen Sperren.
 * Siehe https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
 */
const USER_AGENT = 'fmk-web/0.1 (https://github.com/; Kategorie-Vorschlag beim Promi-Import)';

/** Kuerzer als der TMDB-Timeout: der Vorschlag ist Beiwerk und darf den Dialog nicht aufhalten. */
const TIMEOUT_MS = 5000;

/** Berufe aendern sich praktisch nie — ein Monat Cache ist noch konservativ. */
const REVALIDATE_SECONDS = 30 * 24 * 60 * 60;

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;

/** Prozess-Cache analog zu enrich.ts; haelt auch, wenn Nexts Data-Cache umgangen wird. */
const suggestionCache = new Map<string, { categoryId: string | null; at: number }>();

function cacheGet(qid: string): { categoryId: string | null } | null {
  const hit = suggestionCache.get(qid);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    suggestionCache.delete(qid);
    return null;
  }
  return hit;
}

function cacheSet(qid: string, categoryId: string | null): void {
  // Map haelt Einfuegereihenfolge — der aelteste Key fliegt zuerst raus.
  if (suggestionCache.size >= CACHE_MAX) {
    const oldest = suggestionCache.keys().next();
    if (!oldest.done) suggestionCache.delete(oldest.value);
  }
  suggestionCache.set(qid, { categoryId, at: Date.now() });
}

/** Nur die Form, die wir auswerten — die echte Antwort ist deutlich groesser. */
interface ClaimsResponse {
  claims?: {
    P106?: Array<{
      mainsnak?: { datavalue?: { value?: { id?: string } } };
    }>;
  };
}

/** Q-IDs sind "Q" plus Ziffern. Alles andere geht gar nicht erst raus. */
function isQid(value: string): boolean {
  return /^Q[1-9]\d*$/.test(value);
}

async function fetchOccupationIds(qid: string): Promise<string[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('action', 'wbgetclaims');
  url.searchParams.set('entity', qid);
  url.searchParams.set('property', 'P106');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`Wikidata antwortete mit ${response.status}.`);

  const body = (await response.json()) as ClaimsResponse;
  const ids: string[] = [];
  for (const claim of body.claims?.P106 ?? []) {
    const id = claim.mainsnak?.datavalue?.value?.id;
    if (typeof id === 'string') ids.push(id);
  }
  return ids;
}

/**
 * Kategorie-Vorschlag zu einer Wikidata-ID. Gibt bei fehlender ID, Timeout,
 * 404, kaputter Antwort oder unbekanntem Beruf gleichermassen null zurueck —
 * der Aufrufer muss keinen Fehlerfall unterscheiden, weil es keinen gibt.
 */
export async function suggestCategoryId(wikidataId: string | null | undefined): Promise<string | null> {
  if (typeof window !== 'undefined') return null;
  if (!wikidataId || !isQid(wikidataId)) return null;

  const cached = cacheGet(wikidataId);
  if (cached) return cached.categoryId;

  try {
    const categoryId = categoryForOccupations(await fetchOccupationIds(wikidataId));
    cacheSet(wikidataId, categoryId);
    return categoryId;
  } catch (error) {
    // Bewusst nur geloggt: ein fehlender Vorschlag ist kein Fehlerzustand.
    console.warn(`[wikidata] Vorschlag für ${wikidataId} nicht ermittelbar`, error);
    return null;
  }
}
