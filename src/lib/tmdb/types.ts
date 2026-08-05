/**
 * Nur die Felder, die wir wirklich auswerten — die echten TMDB-Responses sind
 * deutlich groesser. Alles Optionale ist bei TMDB tatsaechlich optional bzw.
 * nullable, auch wenn die Doku das anders suggeriert.
 */

/** Aus /search/person und /person/popular. Enthaelt KEIN birthday. */
export interface TmdbPersonSummary {
  id: number;
  name: string;
  adult: boolean;
  gender: number;
  popularity: number;
  profile_path: string | null;
  known_for_department: string | null;
}

/** Aus /person/{id}. Erst hier gibt es birthday — Basis der Alterssicherung. */
export interface TmdbPersonDetail extends TmdbPersonSummary {
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  biography: string;
  /**
   * Nur vorhanden, wenn append_to_response=external_ids mitgegeben wurde.
   * `wikidata_id` fehlt bei vielen Personen — beides deshalb optional.
   */
  external_ids?: {
    wikidata_id?: string | null;
  };
}

export interface TmdbPagedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

/** Was der Client von unseren Routen bekommt — bewusst flach und schmal. */
export interface CelebrityDto {
  tmdbId: number;
  name: string;
  gender: 'male' | 'female' | 'nonbinary' | 'unspecified';
  /** z.B. "Schauspiel" — schon uebersetzt, der Client formatiert nichts nach. */
  knownFor: string | null;
  /**
   * Kategorie-*Vorschlag* aus dem Wikidata-Beruf, oder null wenn unbekannt.
   * Nur die Detail-Route fuellt das; in Trefferlisten steht hier immer null,
   * weil dort kein Wikidata gefragt wird.
   */
  suggestedCategoryId: string | null;
  birthYear: number | null;
  /** w185 fuers Grid — wird direkt als <img src> gehaengt, nie gespeichert. */
  thumbUrl: string | null;
  /** w500 fuer den Download beim Uebernehmen. */
  profileUrl: string | null;
}

export interface CelebrityPageDto {
  results: CelebrityDto[];
  page: number;
  totalPages: number;
}

export interface PackDto {
  id: string;
  name: string;
  description: string;
}
