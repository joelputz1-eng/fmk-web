import type { TmdbPagedResponse, TmdbPersonDetail, TmdbPersonSummary } from './types';

/**
 * TMDB-Zugriff. Ausschliesslich serverseitig — der Key steht in
 * process.env.TMDB_API_KEY (ohne NEXT_PUBLIC_) und darf nie ins Client-Bundle.
 *
 * Das npm-Paket `server-only` waere der uebliche Build-Time-Riegel, ist hier
 * aber bewusst nicht installiert (keine neuen Dependencies). Der Guard unten
 * schlaegt stattdessen zur Laufzeit zu, falls jemand das Modul aus einer
 * Client-Komponente importiert.
 */

const BASE_URL = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 8000;
/** TMDB-Daten aendern sich traege — ein Tag Cache ist reichlich frisch. */
const REVALIDATE_SECONDS = 86400;

export type TmdbErrorCode =
  | 'missing_key'
  | 'unauthorized'
  | 'rate_limited'
  | 'not_found'
  | 'network'
  | 'upstream';

/** Traegt einen Code, den die Routen 1:1 in Statuscode + UI-Text uebersetzen. */
export class TmdbError extends Error {
  readonly code: TmdbErrorCode;

  constructor(code: TmdbErrorCode, message: string) {
    super(message);
    this.name = 'TmdbError';
    this.code = code;
  }
}

export const TMDB_ERROR_STATUS: Record<TmdbErrorCode, number> = {
  missing_key: 503,
  unauthorized: 503,
  rate_limited: 429,
  not_found: 404,
  network: 502,
  upstream: 502,
};

export const TMDB_ERROR_MESSAGES: Record<TmdbErrorCode, string> = {
  missing_key: 'Kein TMDB-API-Key hinterlegt.',
  unauthorized: 'Der TMDB-API-Key wird von TMDB abgelehnt.',
  rate_limited: 'TMDB drosselt gerade die Anfragen. Kurz warten und nochmal versuchen.',
  not_found: 'Bei TMDB nicht gefunden.',
  network: 'TMDB ist nicht erreichbar.',
  upstream: 'TMDB antwortet gerade nicht wie erwartet.',
};

export function hasApiKey(): boolean {
  return Boolean(process.env.TMDB_API_KEY?.trim());
}

function requireApiKey(): string {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) {
    throw new TmdbError(
      'missing_key',
      'TMDB_API_KEY fehlt. Siehe .env.local.example.',
    );
  }
  return key;
}

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  if (typeof window !== 'undefined') {
    throw new TmdbError('missing_key', 'tmdbFetch darf nur auf dem Server laufen.');
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('api_key', requireApiKey());
  url.searchParams.set('language', 'de-DE');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (error) {
    // Timeout und DNS/Verbindungsfehler landen beide hier.
    throw new TmdbError('network', `TMDB nicht erreichbar: ${String(error)}`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new TmdbError('unauthorized', 'TMDB lehnt den Key ab.');
    if (response.status === 429) throw new TmdbError('rate_limited', 'TMDB Rate-Limit erreicht.');
    if (response.status === 404) throw new TmdbError('not_found', `TMDB 404 für ${path}.`);
    throw new TmdbError('upstream', `TMDB antwortete mit ${response.status}.`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new TmdbError('upstream', 'TMDB-Antwort war kein gültiges JSON.');
  }
}

export function searchPeople(query: string, page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbPersonSummary>>('/search/person', {
    query,
    page,
    include_adult: 'false',
  });
}

export function popularPeople(page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbPersonSummary>>('/person/popular', { page });
}

/**
 * external_ids liefert die Wikidata-ID gratis mit — kein zusaetzlicher
 * TMDB-Request fuer den spaeteren Kategorie-Vorschlag.
 */
export function personDetail(id: number) {
  return tmdbFetch<TmdbPersonDetail>(`/person/${id}`, { append_to_response: 'external_ids' });
}
