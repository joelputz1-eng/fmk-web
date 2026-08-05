import { NextResponse } from 'next/server';
import { personDetail } from '@/lib/tmdb/client';
import { errorResponse, handleRouteError } from '@/lib/tmdb/http';
import { toCelebrityDto } from '@/lib/tmdb/mapping';
import { isAllowed } from '@/lib/tmdb/safety';
import { suggestCategoryId } from '@/lib/wikidata/client';

export const runtime = 'nodejs';

/**
 * GET /api/tmdb/person/[id] — Detail einer Person.
 * Wer die Alterspruefung nicht besteht, existiert fuer die App nicht: 404,
 * damit sich ueber die ID nichts an der Sicherung vorbeiholen laesst.
 *
 * Hier — und nur hier — kommt der Wikidata-Kategorievorschlag dazu. Nicht in
 * den Trefferlisten: 20 Suchergebnisse waeren 20 Wikidata-Requests, von denen
 * 19 nie gebraucht werden.
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
    // Der Vorschlag ist Beiwerk: suggestCategoryId wirft nie, im Zweifel null.
    const suggestedCategoryId = await suggestCategoryId(detail.external_ids?.wikidata_id);
    return NextResponse.json({ ...toCelebrityDto(detail), suggestedCategoryId });
  } catch (error) {
    return handleRouteError(error, `person ${tmdbId}`);
  }
}
