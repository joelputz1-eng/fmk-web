import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, handleRouteError, parsePage } from '@/lib/tmdb/http';
import { toCelebrityDtos } from '@/lib/tmdb/mapping';
import { findPack, loadPack } from '@/lib/tmdb/packs';
import type { CelebrityPageDto } from '@/lib/tmdb/types';

export const runtime = 'nodejs';

/** GET /api/tmdb/packs/[packId]?page= — Personen eines Packs, altersgefiltert. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packId: string }> },
) {
  // Next 15: params ist ein Promise.
  const { packId } = await params;
  const pack = findPack(packId);
  if (!pack) {
    return errorResponse('unknown_pack', `Pack "${packId}" gibt es nicht.`);
  }

  const page = parsePage(request.nextUrl.searchParams.get('page'));

  try {
    const loaded = await loadPack(pack, page);
    const payload: CelebrityPageDto = {
      results: toCelebrityDtos(loaded.results),
      page: loaded.page,
      totalPages: loaded.totalPages,
    };
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error, `pack "${packId}" page ${page}`);
  }
}
