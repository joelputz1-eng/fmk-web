import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStats,
  findMostPolarising,
  findNeverMarried,
  formatShare,
  rankBy,
  MIN_APPEARANCES,
} from '../src/lib/stats/leaderboard.ts';
import type { EntryRecord, RoundItemRecord, Verdict } from '../src/lib/db/schema.ts';

/**
 * Fixtures statt IndexedDB: die Rangregel ist der Teil, der falsch werden kann,
 * und muss ohne Browser und ohne Datenbank pruefbar sein — analog zu
 * tests/safety.test.ts.
 */

function entry(id: string, name: string, deleted = false): EntryRecord {
  return {
    id,
    name,
    gender: 'unspecified',
    isCelebrity: false,
    deletedAt: deleted ? '2025-01-01T00:00:00.000Z' : null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

let itemCounter = 0;

/** Erzeugt Runden-Items fuer einen Eintrag: so oft gefickt, geheiratet, gekillt. */
function items(entryId: string, counts: Partial<Record<Verdict, number>>): RoundItemRecord[] {
  const result: RoundItemRecord[] = [];
  for (const [verdict, count] of Object.entries(counts) as [Verdict, number][]) {
    for (let i = 0; i < count; i += 1) {
      itemCounter += 1;
      result.push({
        id: `item-${itemCounter}`,
        roundId: `round-${itemCounter}`,
        entryId,
        verdict,
        position: 0,
      });
    }
  }
  return result;
}

function statsFor(entries: EntryRecord[], roundItems: RoundItemRecord[]) {
  return buildStats(roundItems, entries);
}

test('Quote schlaegt absolute Zahl', () => {
  const entries = [entry('a', 'Anna'), entry('b', 'Bert')];
  const stats = statsFor(entries, [
    ...items('a', { marry: 3 }),
    ...items('b', { marry: 5, kill: 15 }),
  ]);

  const ranked = rankBy(stats, 'marry');
  // Anna: 3 von 3 = 100 %. Bert: 5 von 20 = 25 % — mehr Marrys, aber nur Anwesenheit.
  assert.deepEqual(
    ranked.map((row) => row.entryId),
    ['a', 'b'],
  );
  assert.equal(ranked[0].shares.marry, 1);
  assert.equal(ranked[1].counts.marry, 5);
});

test('Mindestzahl an Auftritten greift', () => {
  const entries = [entry('a', 'Anna'), entry('b', 'Bert')];
  const stats = statsFor(entries, [...items('a', { marry: 1 }), ...items('b', { marry: 3 })]);

  const ranked = rankBy(stats, 'marry');
  assert.deepEqual(
    ranked.map((row) => row.entryId),
    ['b'],
  );
  // buildStats selbst filtert nicht — nur das Ranking tut es.
  assert.equal(stats.length, 2);
});

test('MIN_APPEARANCES ist 3 und ueberschreibbar', () => {
  assert.equal(MIN_APPEARANCES, 3);
  const stats = statsFor([entry('a', 'Anna')], items('a', { marry: 1 }));
  assert.equal(rankBy(stats, 'marry', 1).length, 1);
});

test('Gleichstand wird deterministisch aufgeloest', () => {
  const entries = [entry('c', 'Cleo'), entry('a', 'Anna'), entry('b', 'Bert')];
  // Gleiche Quote (50 %), unterschiedliche absolute Zahl.
  const roundItems = [
    ...items('c', { marry: 2, kill: 2 }),
    ...items('a', { marry: 3, kill: 3 }),
    ...items('b', { marry: 2, kill: 2 }),
  ];

  const first = rankBy(statsFor(entries, roundItems), 'marry').map((row) => row.entryId);
  // Anna zuerst (3 Marrys), dann Bert und Cleo alphabetisch bei 2 Marrys.
  assert.deepEqual(first, ['a', 'b', 'c']);

  // Andere Eingabereihenfolge, identisches Ergebnis.
  const shuffled = rankBy(statsFor([...entries].reverse(), [...roundItems].reverse()), 'marry');
  assert.deepEqual(
    shuffled.map((row) => row.entryId),
    first,
  );
});

test('Eintraege ohne Auftritte kommen nicht vor', () => {
  const entries = [entry('a', 'Anna'), entry('nie', 'Nie Gespielt')];
  const stats = statsFor(entries, items('a', { marry: 3 }));

  assert.deepEqual(
    stats.map((row) => row.entryId),
    ['a'],
  );
  assert.equal(
    rankBy(stats, 'kill').some((row) => row.entryId === 'nie'),
    false,
  );
});

test('geloeschte Eintraege zaehlen mit und bleiben markiert', () => {
  const entries = [entry('a', 'Anna'), entry('weg', 'Weg Damit', true)];
  const stats = statsFor(entries, [...items('a', { marry: 3 }), ...items('weg', { kill: 3 })]);

  const deleted = stats.find((row) => row.entryId === 'weg');
  assert.ok(deleted);
  assert.equal(deleted.isDeleted, true);
  assert.equal(deleted.appearances, 3);
  assert.equal(rankBy(stats, 'kill')[0].entryId, 'weg');
});

test('Quoten bleiben pro Eintrag vollstaendig', () => {
  const stats = statsFor([entry('a', 'Anna')], items('a', { fuck: 1, marry: 2, kill: 1 }));
  const anna = stats[0];
  assert.equal(anna.appearances, 4);
  assert.deepEqual(anna.counts, { fuck: 1, marry: 2, kill: 1 });
  assert.equal(anna.shares.marry, 0.5);
  assert.equal(anna.shares.fuck + anna.shares.marry + anna.shares.kill, 1);
});

test('Nie geheiratet findet den am haeufigsten Gezogenen ohne Marry', () => {
  const entries = [entry('a', 'Anna'), entry('b', 'Bert'), entry('c', 'Cleo')];
  const stats = statsFor(entries, [
    ...items('a', { fuck: 2, kill: 2 }), // 4 Auftritte, kein Marry
    ...items('b', { fuck: 3, kill: 5 }), // 8 Auftritte, kein Marry
    ...items('c', { marry: 5 }), // heiratet staendig
  ]);

  assert.equal(findNeverMarried(stats)?.entryId, 'b');
});

test('Nie geheiratet respektiert die Schwelle und liefert sonst null', () => {
  const stats = statsFor([entry('a', 'Anna')], items('a', { kill: 2 }));
  assert.equal(findNeverMarried(stats), null);

  const married = statsFor([entry('b', 'Bert')], items('b', { marry: 1, kill: 2 }));
  assert.equal(findNeverMarried(married), null);
});

test('Polarisierend findet die gleichmaessigste Verteilung', () => {
  const entries = [entry('a', 'Anna'), entry('b', 'Bert'), entry('c', 'Cleo')];
  const stats = statsFor(entries, [
    ...items('a', { fuck: 1, marry: 1, kill: 1 }), // perfekt gedrittelt
    ...items('b', { fuck: 4, marry: 1, kill: 1 }), // schief
    ...items('c', { kill: 6 }), // einstimmig, nicht polarisierend
  ]);

  assert.equal(findMostPolarising(stats)?.entryId, 'a');
});

test('Polarisierend verlangt alle drei Urteile', () => {
  const stats = statsFor([entry('a', 'Anna')], items('a', { fuck: 3, kill: 3 }));
  assert.equal(findMostPolarising(stats), null);
});

test('Polarisierend loest Gleichstand ueber Auftritte auf', () => {
  const entries = [entry('a', 'Anna'), entry('b', 'Bert')];
  const stats = statsFor(entries, [
    ...items('a', { fuck: 1, marry: 1, kill: 1 }),
    ...items('b', { fuck: 2, marry: 2, kill: 2 }),
  ]);

  // Gleiche Verteilung — die breitere Datenbasis gewinnt.
  assert.equal(findMostPolarising(stats)?.entryId, 'b');
});

test('formatShare zeigt immer beide Zahlen', () => {
  assert.equal(formatShare(4, 5), '4 von 5 · 80 %');
  assert.equal(formatShare(0, 3), '0 von 3 · 0 %');
  assert.equal(formatShare(1, 3), '1 von 3 · 33 %');
  assert.equal(formatShare(0, 0), '0 von 0 · 0 %');
});
