import { NextResponse } from 'next/server';
import { personDetail } from '@/lib/tmdb/client';
import { errorResponse, handleRouteError } from '@/lib/tmdb/http';
import { toCelebrityDto } from '@/lib/tmdb/mapping';
import { isAllowed } from '@/lib/tmdb/safety';

export const runtime = 'nodejs';

/**
 * GET /api/tmdb/person/[id] — Detail einer Person.
 * Wer die Alterspruefung nicht besteht, existiert fuer die App nicht: 404,
 * damit sich ueber die ID nichts an der Sicherung vorbeiholen laesst.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    return errorResponse('bad_request', 'Ungültige TMDB-ID.');
  }

  try {
    const detail = await personDetail(tmdbId);
    if (!isAllowed(detail)) {
      return errorResponse('not_found', 'Diese Person ist nicht verfügbar.');
    }
    return NextResponse.json(toCelebrityDto(detail));
  } catch (error) {
    return handleRouteError(error, `person ${tmdbId}`);
  }
}
