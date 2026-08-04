import assert from 'node:assert/strict';
import test from 'node:test';
import { ageAt, isAllowed, MIN_AGE } from '../src/lib/tmdb/safety.ts';

/**
 * Fixtures statt Netzwerk: die Alterssicherung (FEATURES.md 4.6) muss ohne
 * TMDB-Key und ohne Internet pruefbar sein.
 *
 * Lauft mit `npm test` (Node-eigener Test-Runner, TypeScript wird von Node
 * direkt gestrippt — deshalb der .ts-Import oben).
 */

/** 15. Juni 2025, fester Stichtag — sonst wandern die Erwartungen mit der Uhr. */
const NOW = new Date('2025-06-15T12:00:00Z');

function person(overrides: {
  birthday?: string | null;
  deathday?: string | null;
  adult?: boolean;
}): { birthday: string | null; deathday: string | null; adult: boolean } {
  return {
    birthday: null,
    deathday: null,
    adult: false,
    ...overrides,
  };
}

test('Person ohne birthday wird immer abgelehnt', () => {
  assert.equal(isAllowed(person({ birthday: null }), NOW), false);
  assert.equal(isAllowed(person({ birthday: '' }), NOW), false);
});

test('kaputte Datumsangaben zaehlen als unbekannt', () => {
  assert.equal(isAllowed(person({ birthday: '1990-13-01' }), NOW), false);
  assert.equal(isAllowed(person({ birthday: '1990-02-30' }), NOW), false);
  assert.equal(isAllowed(person({ birthday: '0000-00-00' }), NOW), false);
  assert.equal(isAllowed(person({ birthday: '1990' }), NOW), false);
});

test('Minderjaehrige fliegen raus, Volljaehrige bleiben drin', () => {
  assert.equal(isAllowed(person({ birthday: '2015-01-01' }), NOW), false);
  assert.equal(isAllowed(person({ birthday: '1980-01-01' }), NOW), true);
});

test('Grenzfall exakt am 18. Geburtstag', () => {
  assert.equal(isAllowed(person({ birthday: '2007-06-15' }), NOW), true);
  assert.equal(isAllowed(person({ birthday: '2007-06-16' }), NOW), false);
});

test('adult-Flag schlaegt jede Altersangabe', () => {
  assert.equal(isAllowed(person({ birthday: '1980-01-01', adult: true }), NOW), false);
});

test('bei Verstorbenen zaehlt das Alter zum Todeszeitpunkt', () => {
  // Mit 12 gestorben — darf nicht dadurch "volljaehrig" werden, dass Zeit vergeht.
  assert.equal(isAllowed(person({ birthday: '1990-01-01', deathday: '2002-01-01' }), NOW), false);
  assert.equal(isAllowed(person({ birthday: '1930-01-01', deathday: '2002-01-01' }), NOW), true);
});

test('kaputtes deathday wird nicht stillschweigend ignoriert', () => {
  assert.equal(isAllowed(person({ birthday: '1930-01-01', deathday: 'unbekannt' }), NOW), false);
});

test('ageAt rechnet volle Lebensjahre', () => {
  assert.equal(ageAt('2000-06-15', NOW), 25);
  assert.equal(ageAt('2000-06-16', NOW), 24);
  assert.equal(ageAt('2000-06-14', NOW), 25);
  assert.equal(ageAt('nope', NOW), null);
});

test('MIN_AGE ist 18', () => {
  assert.equal(MIN_AGE, 18);
});
