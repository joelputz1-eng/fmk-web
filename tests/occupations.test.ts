import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryForOccupations } from '../src/lib/wikidata/occupations.ts';

/**
 * Fixtures statt Netzwerk — genau wie safety.test.ts. Die Q-ID-Listen unten
 * sind echte P106-Antworten von Wikidata, hier eingefroren.
 */

test('bekannte Q-ID trifft die richtige Kategorie', () => {
  assert.equal(categoryForOccupations(['Q33999']), 'premade-actors');
  assert.equal(categoryForOccupations(['Q937857']), 'premade-athletes');
  assert.equal(categoryForOccupations(['Q177220']), 'premade-musicians');
  assert.equal(categoryForOccupations(['Q82955']), 'premade-politicians');
  assert.equal(categoryForOccupations(['Q622807']), 'premade-anime');
  assert.equal(categoryForOccupations(['Q947873']), 'premade-reality-tv');
});

test('Ronaldo landet bei Athletes, nicht bei Reality TV', () => {
  // Echte P106 von Q11571: Fussballspieler, Mode-Unternehmer, Model, Sportler.
  // "Model" wuerde ohne Prioritaet Reality TV gewinnen lassen.
  const ronaldo = ['Q937857', 'Q5436768', 'Q4610556', 'Q2066131'];
  assert.equal(categoryForOccupations(ronaldo), 'premade-athletes');
});

test('Prioritaet gewinnt gegen die Reihenfolge der Antwort', () => {
  // Dieselben Berufe, umgedreht — das Ergebnis darf sich nicht aendern.
  assert.equal(
    categoryForOccupations(['Q4610556', 'Q2066131', 'Q937857']),
    categoryForOccupations(['Q937857', 'Q2066131', 'Q4610556']),
  );
  // Echte P106 von Cillian Murphy (Q202589): Schauspieler mit Band-Vergangenheit.
  // Schauspiel muss vor Musik greifen, sonst wird aus ihm ein Musiker.
  const murphy = ['Q33999', 'Q28389', 'Q36834', 'Q2405480', 'Q639669', 'Q130857'];
  assert.equal(categoryForOccupations(murphy), 'premade-actors');
  // Taylor Swift (Q26876) traegt gar kein "actor" — bleibt Musik.
  assert.equal(categoryForOccupations(['Q488205', 'Q177220', 'Q822146']), 'premade-musicians');
  // Seiyu ist zusaetzlich Synchronsprecher — Anime muss vorher greifen.
  assert.equal(categoryForOccupations(['Q2405480', 'Q622807']), 'premade-anime');
  // Politik schlaegt alles andere.
  assert.equal(categoryForOccupations(['Q33999', 'Q2066131', 'Q82955']), 'premade-politicians');
});

test('unbekannte oder fehlende Berufe ergeben null — nie geraten', () => {
  assert.equal(categoryForOccupations([]), null);
  assert.equal(categoryForOccupations(['Q999999999']), null);
  // Echte P106 von Elisabeth II.: Monarchin, Kfz-Mechanikerin, LKW-Fahrerin,
  // Kunstsammlerin. Nichts davon ist eine unserer sechs Kategorien.
  assert.equal(categoryForOccupations(['Q116', 'Q706835', 'Q508846', 'Q10732476']), null);
  // Unbekanntes neben Bekanntem: das Bekannte zaehlt trotzdem.
  assert.equal(categoryForOccupations(['Q999999999', 'Q33999']), 'premade-actors');
});
