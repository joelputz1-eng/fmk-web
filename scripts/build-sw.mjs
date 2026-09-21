/*
 * Erzeugt public/sw.js aus scripts/sw.template.js. Läuft als `postbuild`,
 * also nach jedem `next build`.
 *
 * Warum überhaupt generiert: Next benennt die Route-Chunks inhaltsgehasht.
 * Eine von Hand gepflegte Precache-Liste kann sie nicht kennen — wer dann eine
 * Seite offline öffnet, deren Chunk nie geladen wurde, bekommt einen
 * ChunkLoadError und eine weiße Seite. Die Namen stehen im Build-Manifest,
 * also holen wir sie da.
 *
 * Die Build-ID landet mit im Worker: ohne veränderten Dateiinhalt bemerkt der
 * Browser keine neue Fassung und installiert nie nach.
 *
 * Keine Abhängigkeiten — nur Node.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const TEMPLATE = 'scripts/sw.template.js';
const OUTPUT = 'public/sw.js';

/** Vom Nutzer erreichbare Seiten. Die HTML-Antworten selbst. */
const ROUTES = ['/', '/play', '/entries', '/lists', '/celebrities', '/history', '/settings'];

/** Statische Dateien, die nicht im Build-Manifest stehen. */
const STATIC_FILES = [
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  if (!existsSync('.next/BUILD_ID')) {
    throw new Error('.next/BUILD_ID fehlt — erst `next build` laufen lassen.');
  }

  const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
  const appManifest = await readJson('.next/app-build-manifest.json');

  /*
   * Aus dem App-Manifest nur die Seiten, nicht die API-Routen: deren Einträge
   * beschreiben Servercode, den der Browser nie lädt.
   */
  const assets = new Set();
  for (const [page, files] of Object.entries(appManifest.pages ?? {})) {
    if (page.includes('/route')) continue;
    for (const file of files) assets.add(`/_next/${file}`);
  }

  const precache = [...ROUTES, ...STATIC_FILES, ...[...assets].sort()];

  const template = await readFile(TEMPLATE, 'utf8');
  const source = template
    .replace('__BUILD_ID__', buildId)
    .replace('__PRECACHE__', JSON.stringify(precache, null, 2));

  if (source.includes('__BUILD_ID__') || source.includes('__PRECACHE__')) {
    throw new Error('Platzhalter in sw.template.js nicht ersetzt — Vorlage prüfen.');
  }

  await writeFile(OUTPUT, source);
  console.log(
    `${OUTPUT} erzeugt — Build ${buildId}, ${precache.length} Einträge ` +
      `(${ROUTES.length} Seiten, ${assets.size} Assets).`,
  );
}

await main();
