import { NextResponse } from 'next/server';
import { TMDB_ERROR_MESSAGES, TMDB_ERROR_STATUS, TmdbError, type TmdbErrorCode } from './client';

/** Gemeinsame Fehlerform aller /api/tmdb-Routen: { error: { code, message } }. */
export type ApiErrorCode = TmdbErrorCode | 'bad_request' | 'unknown_pack';

const STATUS: Record<ApiErrorCode, number> = {
  ...TMDB_ERROR_STATUS,
  bad_request: 400,
  unknown_pack: 404,
};

export function errorResponse(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] });
}

/**
 * Alles, was aus dem TMDB-Layer hochblubbert, in eine Response uebersetzen.
 * Ein fehlender Key ist hier ausdruecklich kein Crash, sondern ein 503 mit
 * Code, den die UI in einen Setup-Hinweis verwandelt.
 */
export function handleRouteError(error: unknown, context: string): NextResponse {
  if (error instanceof TmdbError) {
    if (error.code !== 'missing_key') console.error(`[tmdb] ${context}`, error.message);
    return errorResponse(error.code, TMDB_ERROR_MESSAGES[error.code]);
  }
  console.error(`[tmdb] ${context}`, error);
  return errorResponse('upstream', TMDB_ERROR_MESSAGES.upstream);
}

/** Seitenzahl aus der Query — kaputte Werte werden zu 1, nicht zu einem Fehler. */
export function parsePage(raw: string | null): number {
  const page = Number(raw ?? '1');
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), 500);
}
