import { NextResponse, type NextRequest } from 'next/server';
import { searchPeople } from '@/lib/tmdb/client';
import { enrichAndFilter } from '@/lib/tmdb/enrich';
import { errorResponse, handleRouteError, parsePage } from '@/lib/tmdb/http';
import { toCelebrityDtos } from '@/lib/tmdb/mapping';
import type { CelebrityPageDto } from '@/lib/tmdb/types';

export const runtime = 'nodejs';

/** GET /api/tmdb/search?q=&page= — Personensuche, altersgefiltert. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const page = parsePage(request.nextUrl.searchParams.get('page'));

  if (!query) {
    return errorResponse('bad_request', 'Parameter q fehlt.');
  }

  try {
    const response = await searchPeople(query, page);
    const details = await enrichAndFilter(response.results);
    const payload: CelebrityPageDto = {
      results: toCelebrityDtos(details),
      page: response.page,
      totalPages: Math.min(response.total_pages, 500),
    };
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error, `search "${query}"`);
  }
}
