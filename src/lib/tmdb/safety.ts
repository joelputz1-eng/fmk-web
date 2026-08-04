import type { TmdbPersonDetail } from './types';

/**
 * Alterssicherung (FEATURES.md 4.6) — nicht verhandelbar und deshalb an genau
 * einer Stelle: jede Route laesst ihre Kandidaten durch enrichAndFilter()
 * (siehe ./enrich.ts), das wiederum diese Regeln anwendet.
 *
 * Diese Datei bleibt bewusst frei von Netzwerk und Laufzeit-Imports: reine
 * Regeln, direkt testbar (tests/safety.test.ts).
 */

export const MIN_AGE = 18;

/** Volle Lebensjahre zwischen einem ISO-Datum (YYYY-MM-DD) und einem Stichtag. */
export function ageAt(birthday: string, reference: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const birth = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Date.UTC rollt ungueltige Daten still weiter (2001-02-30 → 02. Maerz) —
  // der Rueckvergleich faengt das ab.
  if (
    birth.getUTCFullYear() !== Number(year) ||
    birth.getUTCMonth() !== Number(month) - 1 ||
    birth.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  if (Number.isNaN(reference.getTime())) return null;

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

/**
 * Die eigentliche Regel. Alles, was nicht beweisbar erwachsen ist, faellt raus:
 * fehlendes oder kaputtes birthday, adult-Flag, Alter unter 18. Bei
 * Verstorbenen zaehlt das Alter zum Todeszeitpunkt — sonst wuerde ein mit 12
 * verstorbenes Kind irgendwann automatisch "volljaehrig" werden.
 */
export function isAllowed(
  detail: Pick<TmdbPersonDetail, 'birthday' | 'deathday' | 'adult'>,
  now: Date = new Date(),
): boolean {
  if (detail.adult === true) return false;
  if (!detail.birthday) return false;

  let reference = now;
  if (detail.deathday) {
    const parsed = new Date(`${detail.deathday.trim().slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    reference = parsed;
  }

  const age = ageAt(detail.birthday, reference);
  return age !== null && age >= MIN_AGE;
}
