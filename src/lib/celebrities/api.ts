import type { CelebrityPageDto, PackDto } from '@/lib/tmdb/types';

/**
 * Clientseitiger Zugriff auf die eigenen /api/tmdb-Routen. TMDB selbst wird von
 * hier aus nie angesprochen — der Key bleibt auf dem Server.
 */

export class CelebrityApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CelebrityApiError';
    this.code = code;
  }
}

/** true, wenn nur der Setup-Schritt fehlt (kein/ungueltiger Key) — kein echter Fehler. */
export function isSetupError(error: unknown): boolean {
  return (
    error instanceof CelebrityApiError &&
    (error.code === 'missing_key' || error.code === 'unauthorized')
  );
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new CelebrityApiError('network', 'Keine Verbindung zum Server.');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error =
      typeof body === 'object' && body !== null
        ? (body as { error?: { code?: string; message?: string } }).error
        : undefined;
    throw new CelebrityApiError(
      error?.code ?? 'upstream',
      error?.message ?? 'Die Anfrage ist fehlgeschlagen.',
    );
  }

  return (await response.json()) as T;
}

export function searchCelebrities(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<CelebrityPageDto> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return getJson<CelebrityPageDto>(`/api/tmdb/search?${params}`, signal);
}

export async function fetchPacks(signal?: AbortSignal): Promise<PackDto[]> {
  const body = await getJson<{ packs: PackDto[] }>('/api/tmdb/packs', signal);
  return body.packs;
}

export function fetchPack(
  packId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<CelebrityPageDto> {
  const params = new URLSearchParams({ page: String(page) });
  return getJson<CelebrityPageDto>(
    `/api/tmdb/packs/${encodeURIComponent(packId)}?${params}`,
    signal,
  );
}
