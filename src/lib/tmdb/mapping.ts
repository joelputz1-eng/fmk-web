import { isAllowed } from './safety';
import type { CelebrityDto, TmdbPersonDetail } from './types';

/** TMDB → App-Modell. Die einzige Stelle, an der TMDB-Vokabular uebersetzt wird. */

const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type ProfileSize = 'w185' | 'w342' | 'w500';

export function profileImageUrl(path: string | null, size: ProfileSize): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

/** TMDB kodiert Gender numerisch: 0 unbekannt, 1 weiblich, 2 maennlich, 3 non-binaer. */
export function mapGender(gender: number): CelebrityDto['gender'] {
  if (gender === 1) return 'female';
  if (gender === 2) return 'male';
  if (gender === 3) return 'nonbinary';
  return 'unspecified';
}

/**
 * known_for_department kommt immer englisch, unabhaengig von `language`.
 * Fuer alles Unbekannte zeigen wir lieber den Rohwert als "Sonstiges".
 */
const DEPARTMENT_LABELS: Record<string, string> = {
  Acting: 'Schauspiel',
  Directing: 'Regie',
  Writing: 'Drehbuch',
  Production: 'Produktion',
  Sound: 'Musik & Ton',
  Camera: 'Kamera',
  Editing: 'Schnitt',
  Art: 'Ausstattung',
  'Costume & Make-Up': 'Kostüm & Maske',
  'Visual Effects': 'Visual Effects',
  Lighting: 'Licht',
  Crew: 'Crew',
};

export function departmentLabel(department: string | null): string | null {
  if (!department) return null;
  return DEPARTMENT_LABELS[department] ?? department;
}

function birthYear(birthday: string | null): number | null {
  const match = birthday ? /^(\d{4})/.exec(birthday.trim()) : null;
  return match ? Number(match[1]) : null;
}

export function toCelebrityDto(detail: TmdbPersonDetail): CelebrityDto {
  return {
    tmdbId: detail.id,
    name: detail.name,
    gender: mapGender(detail.gender),
    knownFor: departmentLabel(detail.known_for_department),
    // Bewusst immer null: known_for_department beschreibt die Rolle in einer
    // Filmproduktion, nicht den Beruf. Ronaldo stand darueber auf "Acting".
    // Den Vorschlag setzt allein die Detail-Route aus dem Wikidata-Beruf.
    suggestedCategoryId: null,
    birthYear: birthYear(detail.birthday),
    thumbUrl: profileImageUrl(detail.profile_path, 'w185'),
    profileUrl: profileImageUrl(detail.profile_path, 'w500'),
  };
}

/**
 * Letzte Reissleine vor der Response: das DTO entsteht nur aus Details, die
 * isAllowed() bestanden haben. Falls jemals ein Pfad an enrichAndFilter
 * vorbeibaut, faellt es hier auf.
 */
export function toCelebrityDtos(details: TmdbPersonDetail[]): CelebrityDto[] {
  return details.filter((detail) => isAllowed(detail)).map(toCelebrityDto);
}
