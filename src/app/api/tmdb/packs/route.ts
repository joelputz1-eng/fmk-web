import { NextResponse } from 'next/server';
import { hasApiKey } from '@/lib/tmdb/client';
import { errorResponse } from '@/lib/tmdb/http';
import { listPacks } from '@/lib/tmdb/packs';

export const runtime = 'nodejs';

/**
 * GET /api/tmdb/packs — nur Metadaten, keine Personen.
 * Die Pack-Liste steht lokal fest; ohne Key waere sie trotzdem nutzlos, also
 * antwortet auch diese Route mit dem Setup-Hinweis.
 */
export async function GET() {
  if (!hasApiKey()) {
    return errorResponse('missing_key', 'Kein TMDB-API-Key hinterlegt.');
  }
  return NextResponse.json({ packs: listPacks() });
}
