import type { Gender } from '@/lib/db/schema';

/**
 * Format und Kodierung des Teilen-Links (FEATURES.md 5.5).
 *
 * Die Liste reist komprimiert im Fragment der URL. Das Fragment schickt der
 * Browser nie an einen Server — bei Listen mit Namen echter Personen ist genau
 * das der Punkt, nicht nur eine huebsche Nebenwirkung.
 *
 * Diese Datei ist frei von IndexedDB und React: der Inhalt eines Links ist
 * fremde Eingabe, und die Regeln dafuer muessen mit Fixtures pruefbar sein —
 * dieselbe Trennung wie in src/lib/tmdb/safety.ts.
 *
 * Nur `import type` nach aussen, damit der Test die Datei ohne Bundler laden kann.
 */

/** Aktuelles Format. Aeltere Apps lehnen hoehere Nummern sauber ab, statt zu raten. */
export const PAYLOAD_VERSION = 1;

/**
 * Darueber kuerzen Messenger und Vorschaudienste gern mit. Lieber vorher sagen,
 * dass es nicht geht, als einen Link ausgeben, der unterwegs zerbricht.
 */
export const MAX_LINK_LENGTH = 2000;

/**
 * Harte Grenze beim Entpacken. `DecompressionStream` macht aus wenigen Bytes
 * beliebig viel — ohne diese Grenze reicht ein praeparierter Link, um den Tab
 * zum Stillstand zu bringen.
 */
export const MAX_DECOMPRESSED_BYTES = 256 * 1024;

export const MAX_ENTRIES = 500;
export const MAX_NAME_LENGTH = 120;
export const MAX_NOTE_LENGTH = 500;
export const MAX_CATEGORIES = 50;

/** Kurze Schluessel: jedes Byte landet vor der Kompression im Link. */
export interface PayloadCategory {
  /** Name. */
  n: string;
  /** Farbe als Hex. */
  f: string;
  /** Stabile ID einer Premade-Kategorie, sonst nicht gesetzt. */
  p?: string;
}

export interface PayloadEntry {
  /** Name. */
  n: string;
  /** Geschlecht. */
  g: Gender;
  /** Notiz. */
  o?: string;
  /** TMDB-Kennung bei Promis. */
  t?: number;
  /** Indizes in die Kategorienliste des Pakets. */
  c?: number[];
}

export interface ListPayload {
  v: number;
  /** Listenname. */
  n: string;
  c: PayloadCategory[];
  e: PayloadEntry[];
}

/**
 * Jeder Fehlergrund ist von aussen unterscheidbar, damit die Oberflaeche
 * "unvollstaendiger Link" und "App zu alt" nicht in denselben Satz wirft.
 */
export type DecodeError =
  | 'empty'
  | 'malformed'
  | 'too-large'
  | 'unsupported-version'
  | 'invalid-structure';

export type DecodeResult =
  | { ok: true; payload: ListPayload }
  | { ok: false; error: DecodeError };

const GENDERS: readonly Gender[] = ['male', 'female', 'nonbinary', 'unspecified'];

// ---------------------------------------------------------------- base64url

/**
 * base64url statt base64: `+`, `/` und `=` muessten im Fragment escaped werden
 * und ueberleben das Kopieren aus Messengern nicht zuverlaessig.
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // Stueckweise, weil String.fromCharCode bei grossen Arrays den Stack sprengt.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- Kodieren

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Paket → base64url. Das Ergebnis enthaelt nur `A-Z a-z 0-9 - _`. */
export async function encodeListPayload(payload: ListPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const compressed = await deflate(new TextEncoder().encode(json));
  return toBase64Url(compressed);
}

/** Vollstaendiger Link. Die Nutzdaten stehen ausschliesslich hinter dem `#`. */
export function buildShareUrl(origin: string, encoded: string): string {
  return `${origin.replace(/\/$/, '')}/lists/import#${encoded}`;
}

/** true, wenn der Link so lang wird, dass er unterwegs zerbrechen kann. */
export function isLinkTooLong(url: string): boolean {
  return url.length > MAX_LINK_LENGTH;
}

// ------------------------------------------------------------- Dekodieren

/**
 * Entpackt mit laufender Summe und bricht an der Grenze ab. Erst alles
 * entpacken und dann messen waere wirkungslos — bis dahin liegt die Bombe
 * bereits im Speicher.
 */
async function inflateLimited(bytes: Uint8Array): Promise<Uint8Array | 'too-large' | null> {
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
      .getReader() as ReadableStreamDefaultReader<Uint8Array>;
  } catch {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_DECOMPRESSED_BYTES) {
        void reader.cancel();
        return 'too-large';
      }
      chunks.push(value);
    }
  } catch {
    // Kaputter oder abgeschnittener Datenstrom.
    return null;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Text auf die zulaessige Laenge bringen. Leer nach dem Trimmen zaehlt als fehlend. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Prueft die entpackte Struktur Feld fuer Feld. Alles, was nicht passt, fuehrt
 * zur Ablehnung des ganzen Pakets — ein halb verstandener Link ist schlimmer
 * als gar keiner, weil niemand sieht, was fehlt.
 */
export function validatePayload(value: unknown): DecodeResult {
  if (!isRecord(value)) return { ok: false, error: 'invalid-structure' };

  if (typeof value.v !== 'number' || !Number.isInteger(value.v)) {
    return { ok: false, error: 'invalid-structure' };
  }
  if (value.v !== PAYLOAD_VERSION) return { ok: false, error: 'unsupported-version' };

  const listName = cleanText(value.n, MAX_NAME_LENGTH);
  if (!listName) return { ok: false, error: 'invalid-structure' };

  const rawCategories = value.c;
  if (!Array.isArray(rawCategories) || rawCategories.length > MAX_CATEGORIES) {
    return { ok: false, error: 'invalid-structure' };
  }

  const categories: PayloadCategory[] = [];
  for (const raw of rawCategories) {
    if (!isRecord(raw)) return { ok: false, error: 'invalid-structure' };
    const name = cleanText(raw.n, MAX_NAME_LENGTH);
    if (!name) return { ok: false, error: 'invalid-structure' };
    // Farbe muss eine Hex-Angabe sein, sonst landet sie ungeprueft in einem
    // style-Attribut.
    const color = typeof raw.f === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.f) ? raw.f : null;
    if (!color) return { ok: false, error: 'invalid-structure' };
    const premadeId =
      typeof raw.p === 'string' && /^[a-z0-9-]{1,40}$/.test(raw.p) ? raw.p : undefined;
    categories.push({ n: name, f: color, ...(premadeId ? { p: premadeId } : {}) });
  }

  const rawEntries = value.e;
  if (!Array.isArray(rawEntries)) return { ok: false, error: 'invalid-structure' };
  if (rawEntries.length === 0 || rawEntries.length > MAX_ENTRIES) {
    return { ok: false, error: 'invalid-structure' };
  }

  const entries: PayloadEntry[] = [];
  for (const raw of rawEntries) {
    if (!isRecord(raw)) return { ok: false, error: 'invalid-structure' };

    const name = cleanText(raw.n, MAX_NAME_LENGTH);
    if (!name) return { ok: false, error: 'invalid-structure' };

    const gender = GENDERS.includes(raw.g as Gender) ? (raw.g as Gender) : 'unspecified';
    const note = raw.o === undefined ? null : cleanText(raw.o, MAX_NOTE_LENGTH);

    let tmdbId: number | undefined;
    if (raw.t !== undefined) {
      if (typeof raw.t !== 'number' || !Number.isInteger(raw.t) || raw.t <= 0) {
        return { ok: false, error: 'invalid-structure' };
      }
      tmdbId = raw.t;
    }

    let categoryIndexes: number[] | undefined;
    if (raw.c !== undefined) {
      if (!Array.isArray(raw.c)) return { ok: false, error: 'invalid-structure' };
      const indexes: number[] = [];
      for (const index of raw.c) {
        if (typeof index !== 'number' || !Number.isInteger(index)) {
          return { ok: false, error: 'invalid-structure' };
        }
        // Verweis ins Leere: das Paket beschreibt etwas, das es nicht gibt.
        if (index < 0 || index >= categories.length) {
          return { ok: false, error: 'invalid-structure' };
        }
        if (!indexes.includes(index)) indexes.push(index);
      }
      if (indexes.length > 0) categoryIndexes = indexes;
    }

    entries.push({
      n: name,
      g: gender,
      ...(note ? { o: note } : {}),
      ...(tmdbId !== undefined ? { t: tmdbId } : {}),
      ...(categoryIndexes ? { c: categoryIndexes } : {}),
    });
  }

  return { ok: true, payload: { v: PAYLOAD_VERSION, n: listName, c: categories, e: entries } };
}

/** base64url → geprueftes Paket. Wirft nicht; jeder Fehler kommt als Ergebnis zurueck. */
export async function decodeListPayload(encoded: string): Promise<DecodeResult> {
  const trimmed = encoded.trim().replace(/^#/, '');
  if (!trimmed) return { ok: false, error: 'empty' };

  const bytes = fromBase64Url(trimmed);
  if (!bytes) return { ok: false, error: 'malformed' };

  const inflated = await inflateLimited(bytes);
  if (inflated === 'too-large') return { ok: false, error: 'too-large' };
  if (!inflated) return { ok: false, error: 'malformed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(inflated));
  } catch {
    return { ok: false, error: 'malformed' };
  }

  return validatePayload(parsed);
}

/** Zum Fehlergrund passender Satz fuer die Oberflaeche. */
export const DECODE_ERROR_MESSAGES: Record<DecodeError, string> = {
  empty: 'Dieser Link enthält keine Liste. Vermutlich ist beim Kopieren der Teil hinter dem # verlorengegangen.',
  malformed:
    'Der Link ist unvollständig oder beschädigt. Lass ihn dir noch einmal schicken — Messenger kürzen lange Links manchmal.',
  'too-large': 'Der Link enthält weit mehr Daten, als eine Liste je umfasst. Er wurde nicht geöffnet.',
  'unsupported-version':
    'Dieser Link stammt aus einer neueren Version der App. Lade die Seite neu, um zu aktualisieren.',
  'invalid-structure': 'Der Inhalt des Links ergibt keine gültige Liste.',
};
