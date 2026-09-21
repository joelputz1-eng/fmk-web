import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildShareUrl,
  decodeListPayload,
  encodeListPayload,
  isLinkTooLong,
  validatePayload,
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  PAYLOAD_VERSION,
  type ListPayload,
} from '../src/lib/share/listPayload.ts';

/**
 * Der Inhalt eines Teilen-Links ist fremde Eingabe. Diese Regeln muessen ohne
 * Browser und ohne Datenbank pruefbar sein — analog tests/safety.test.ts.
 */

function payload(overrides: Partial<ListPayload> = {}): ListPayload {
  return {
    v: PAYLOAD_VERSION,
    n: 'Uni-Freunde',
    c: [{ n: 'Schauspiel', f: '#e11d48', p: 'premade-actors' }],
    e: [
      { n: 'Anna Berg', g: 'female', o: 'aus dem Sportkurs', c: [0] },
      { n: 'Bruno Klar', g: 'male' },
      { n: 'Zendaya', g: 'female', t: 505710, c: [0] },
    ],
    ...overrides,
  };
}

test('Rundlauf erhaelt alle Felder', async () => {
  const original = payload();
  const encoded = await encodeListPayload(original);
  const result = await decodeListPayload(encoded);

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.deepEqual(result.payload, original);
});

test('kodiert ausschliesslich base64url-Zeichen', async () => {
  const encoded = await encodeListPayload(payload());
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
});

test('Kompression lohnt sich bei echten Listen', async () => {
  const names = Array.from({ length: 30 }, (_, i) => ({
    n: `Testperson Nummer ${i}`,
    g: 'unspecified' as const,
    c: [0],
  }));
  const encoded = await encodeListPayload(payload({ e: names }));
  const url = buildShareUrl('https://example.com', encoded);
  // 30 Namen muessen verlaesslich teilbar bleiben.
  assert.equal(isLinkTooLong(url), false, `Link war ${url.length} Zeichen lang`);
});

test('Nutzdaten stehen hinter dem Rautezeichen', () => {
  const url = buildShareUrl('https://example.com/', 'AbC-_123');
  assert.equal(url, 'https://example.com/lists/import#AbC-_123');
  const parsed = new URL(url);
  assert.equal(parsed.search, '');
  assert.equal(parsed.pathname, '/lists/import');
});

test('leeres Fragment wird als leer gemeldet', async () => {
  for (const input of ['', '   ', '#']) {
    const result = await decodeListPayload(input);
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.equal(result.error, 'empty');
  }
});

test('abgeschnittener Link wird abgelehnt', async () => {
  const encoded = await encodeListPayload(payload());
  const cut = encoded.slice(0, Math.floor(encoded.length / 2));
  const result = await decodeListPayload(cut);

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.error, 'malformed');
});

test('Fremdinhalt hinter dem Rautezeichen wird abgelehnt', async () => {
  for (const junk of ['hallo welt', 'section-2', '%%%%', 'a'.repeat(50)]) {
    const result = await decodeListPayload(junk);
    assert.equal(result.ok, false, `"${junk}" haette abgelehnt werden muessen`);
    assert.ok(!result.ok);
    assert.equal(result.error, 'malformed');
  }
});

test('unbekannte Version wird als solche gemeldet, nicht als kaputt', async () => {
  const encoded = await encodeListPayload(payload({ v: PAYLOAD_VERSION + 1 }));
  const result = await decodeListPayload(encoded);

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.error, 'unsupported-version');
});

test('Ueberlaenge bei Name und Notiz wird gekappt', () => {
  const result = validatePayload(
    payload({
      e: [{ n: 'A'.repeat(500), g: 'male', o: 'B'.repeat(2000) }],
    }),
  );

  assert.ok(result.ok);
  assert.equal(result.payload.e[0].n.length, MAX_NAME_LENGTH);
  assert.equal(result.payload.e[0].o?.length, MAX_NOTE_LENGTH);
});

test('zu viele Eintraege werden abgelehnt', () => {
  const tooMany = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => ({
    n: `Person ${i}`,
    g: 'unspecified' as const,
  }));
  const result = validatePayload(payload({ e: tooMany }));

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.error, 'invalid-structure');
});

test('Liste ohne Eintraege ist kein gueltiges Paket', () => {
  const result = validatePayload(payload({ e: [] }));
  assert.equal(result.ok, false);
});

test('Kategorieverweis ausserhalb des Bereichs wird abgelehnt', () => {
  for (const index of [1, -1, 99]) {
    const result = validatePayload(
      payload({
        c: [{ n: 'Schauspiel', f: '#e11d48' }],
        e: [{ n: 'Anna Berg', g: 'female', c: [index] }],
      }),
    );
    assert.equal(result.ok, false, `Index ${index} haette abgelehnt werden muessen`);
    assert.ok(!result.ok);
    assert.equal(result.error, 'invalid-structure');
  }
});

test('Kategoriefarbe muss eine Hex-Angabe sein', () => {
  for (const color of ['rot', 'javascript:alert(1)', '#xyzxyz', '', '#fff']) {
    const result = validatePayload(payload({ c: [{ n: 'Test', f: color }], e: [{ n: 'A', g: 'male' }] }));
    assert.equal(result.ok, false, `Farbe "${color}" haette abgelehnt werden muessen`);
  }
});

test('unbekanntes Geschlecht faellt auf unspecified zurueck', () => {
  const result = validatePayload(payload({ e: [{ n: 'Anna', g: 'alien' as never }] }));
  assert.ok(result.ok);
  assert.equal(result.payload.e[0].g, 'unspecified');
});

test('kaputte TMDB-Kennung wird abgelehnt, fehlende ist in Ordnung', () => {
  for (const id of [0, -5, 1.5, 'abc' as never]) {
    const result = validatePayload(payload({ e: [{ n: 'Anna', g: 'female', t: id as number }] }));
    assert.equal(result.ok, false, `t=${String(id)} haette abgelehnt werden muessen`);
  }
  const ohne = validatePayload(payload({ e: [{ n: 'Anna', g: 'female' }] }));
  assert.ok(ohne.ok);
  assert.equal(ohne.payload.e[0].t, undefined);
});

test('doppelte Kategorieverweise werden zusammengefasst', () => {
  const result = validatePayload(
    payload({
      c: [{ n: 'Schauspiel', f: '#e11d48' }],
      e: [{ n: 'Anna', g: 'female', c: [0, 0, 0] }],
    }),
  );
  assert.ok(result.ok);
  assert.deepEqual(result.payload.e[0].c, [0]);
});

test('Listenname ohne Inhalt ist ungueltig', () => {
  for (const name of ['', '   ', 42 as never, null as never]) {
    const result = validatePayload(payload({ n: name as string }));
    assert.equal(result.ok, false, `Name ${JSON.stringify(name)} haette abgelehnt werden muessen`);
  }
});

test('kein Array, kein Objekt, kein Paket', () => {
  for (const value of [null, 42, 'text', [], undefined]) {
    const result = validatePayload(value);
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.equal(result.error, 'invalid-structure');
  }
});

test('aufgeblaehter Datenstrom bricht an der Grenze ab', async () => {
  // Eine Dekompressionsbombe im Kleinen: 4 MB gleicher Bytes schrumpfen auf
  // wenige Kilobyte. Ohne Grenze beim Entpacken reicht so ein Link, um den
  // Tab lahmzulegen.
  const riesig = new Uint8Array(4 * 1024 * 1024);
  const stream = new Blob([riesig]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const komprimiert = new Uint8Array(await new Response(stream).arrayBuffer());
  const base64url = Buffer.from(komprimiert)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  assert.ok(komprimiert.byteLength < 64 * 1024, 'Testdaten sind nicht klein genug');

  const result = await decodeListPayload(base64url);
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.error, 'too-large');
});
