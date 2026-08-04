import { popularPeople, tmdbFetch } from './client';
import { enrichAndFilter } from './enrich';
import type { PackDto, TmdbPagedResponse, TmdbPersonDetail, TmdbPersonSummary } from './types';

/**
 * Kuratierte Packs (4.1).
 *
 * TMDB hat fuer Personen nur drei brauchbare Listen-Endpoints: /person/popular,
 * /trending/person/{window} und /search/person. Ein /discover fuer Personen
 * existiert nicht. Alles, was darueber hinausgeht (Department, Jahrgang),
 * entsteht deshalb als serverseitiger Filter auf den angereicherten Details —
 * denselben Details, die wir fuer die Alterspruefung ohnehin schon holen.
 *
 * Ein Pack "Musik" ist bewusst NICHT dabei: /person/popular besteht praktisch
 * nur aus Acting, ein Sound-Filter darauf liefert leere Seiten. Das waere ein
 * Pack, das so tut als ob.
 */

/** TMDB liefert ab Seite 501 nichts mehr, egal was total_pages behauptet. */
const MAX_TMDB_PAGE = 500;

interface PackDefinition extends PackDto {
  /** Wieviele TMDB-Seiten eine Pack-Seite zusammenzieht. Gefilterte Packs brauchen mehr. */
  scan: number;
  fetchSource(page: number): Promise<TmdbPagedResponse<TmdbPersonSummary>>;
  /** Zusatzfilter nach der Anreicherung. Ohne Angabe bleibt alles drin. */
  refine?(detail: TmdbPersonDetail): boolean;
}

function trendingPeople(window: 'day' | 'week', page: number) {
  return tmdbFetch<TmdbPagedResponse<TmdbPersonSummary>>(`/trending/person/${window}`, { page });
}

const BEHIND_CAMERA = new Set(['Directing', 'Writing', 'Production', 'Camera', 'Editing']);

const PACKS: PackDefinition[] = [
  {
    id: 'popular',
    name: 'Beliebt aktuell',
    description: 'Die Personen, die bei TMDB gerade am meisten aufgerufen werden.',
    scan: 1,
    fetchSource: (page) => popularPeople(page),
  },
  {
    id: 'trending-week',
    name: 'Diese Woche im Gespräch',
    description: 'TMDB-Trends der letzten sieben Tage.',
    scan: 1,
    fetchSource: (page) => trendingPeople('week', page),
  },
  {
    id: 'trending-day',
    name: 'Heute im Gespräch',
    description: 'Was seit gestern nach oben gespült wurde.',
    scan: 1,
    fetchSource: (page) => trendingPeople('day', page),
  },
  {
    id: 'acting',
    name: 'Schauspiel',
    description: 'Beliebte Personen, deren Schwerpunkt vor der Kamera liegt.',
    scan: 2,
    fetchSource: (page) => popularPeople(page),
    refine: (detail) => detail.known_for_department === 'Acting',
  },
  {
    id: 'behind-camera',
    name: 'Hinter der Kamera',
    description: 'Regie, Drehbuch, Produktion, Kamera, Schnitt.',
    scan: 3,
    fetchSource: (page) => popularPeople(page),
    refine: (detail) => BEHIND_CAMERA.has(detail.known_for_department ?? ''),
  },
  {
    id: 'legends',
    name: 'Legenden',
    description: 'Bekannte Gesichter mit Jahrgang vor 1970.',
    scan: 3,
    fetchSource: (page) => popularPeople(page),
    refine: (detail) => {
      const match = detail.birthday ? /^(\d{4})/.exec(detail.birthday) : null;
      return match !== null && Number(match[1]) < 1970;
    },
  },
];

export function listPacks(): PackDto[] {
  return PACKS.map(({ id, name, description }) => ({ id, name, description }));
}

export function findPack(packId: string): PackDefinition | undefined {
  return PACKS.find((pack) => pack.id === packId);
}

/**
 * Laedt eine Pack-Seite: `scan` TMDB-Seiten einsammeln, in einem Rutsch
 * anreichern + alterspruefen, danach den Pack-Filter anwenden.
 */
export async function loadPack(
  pack: PackDefinition,
  page: number,
): Promise<{ results: TmdbPersonDetail[]; page: number; totalPages: number }> {
  const firstSourcePage = (page - 1) * pack.scan + 1;
  const summaries: TmdbPersonSummary[] = [];
  let sourceTotalPages = 1;

  for (let offset = 0; offset < pack.scan; offset += 1) {
    const sourcePage = firstSourcePage + offset;
    if (sourcePage > MAX_TMDB_PAGE) break;
    if (offset > 0 && sourcePage > sourceTotalPages) break;

    const response = await pack.fetchSource(sourcePage);
    sourceTotalPages = Math.min(response.total_pages, MAX_TMDB_PAGE);
    summaries.push(...response.results);
    if (sourcePage >= sourceTotalPages) break;
  }

  const details = await enrichAndFilter(summaries);
  const results = pack.refine ? details.filter(pack.refine) : details;

  return {
    results,
    page,
    totalPages: Math.max(1, Math.ceil(sourceTotalPages / pack.scan)),
  };
}
