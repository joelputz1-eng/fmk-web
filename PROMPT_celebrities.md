# Aufgabe: Celebrity-Modus (TMDB) implementieren — Phase 4

Du arbeitest im bestehenden Projekt `fuck marry kill` (Next.js 15 App Router, React 19,
TypeScript strict, Tailwind 3, IndexedDB via `idb`). Lies zuerst `FEATURES.md`
(Abschnitt 4) und den bestehenden Code, bevor du irgendetwas änderst.

## Ziel

Der Platzhalter `src/app/celebrities/page.tsx` wird durch einen funktionierenden
Celebrity-Modus ersetzt: Promis über die TMDB-API suchen und in kuratierten Packs
browsen, mit Profilbild, und per Klick als normalen `EntryRecord` in die lokale DB
und in eine Liste übernehmen. Danach verhalten sie sich wie jeder andere Eintrag
(spielbar, filterbar, in Stats).

## Was schon da ist (nicht neu bauen, wiederverwenden)

- `src/lib/db/schema.ts` — `EntryRecord` hat bereits `isCelebrity: boolean` und
  `tmdbId?: number`. Der Store `tmdbCache` (`{ tmdbId, payload, cachedAt }`) existiert
  schon in DB-Version 1, ist aber ungenutzt.
- `src/lib/db/entries.ts` — `createEntry`, `savePhoto`, `getPhotoBlob`, Soft-Delete,
  Duplikat-Erkennung über Namen.
- `src/lib/db/lists.ts` — `setListMembership(listId, entryId, member)`.
- `src/lib/photo/resize.ts` — `processPhoto(blob)`: Square-Crop → 512×512 → WebP.
  Für TMDB-Bilder exakt diese Pipeline verwenden.
- `src/components/entry/EntryAvatar.tsx` + `useObjectUrl` — rendert Fotos aus dem
  `photos`-Store, sonst Initialen.
- `src/components/ui/Feedback.tsx` — `PageHeader`, `Loading`, `EmptyState`, `Notice`.
- `next.config.mjs` — `image.tmdb.org` ist schon in `images.remotePatterns`.
- `.env.local.example` — `TMDB_API_KEY` (v3), **ohne** `NEXT_PUBLIC_`-Prefix.

## Harte Randbedingungen

1. **Der API-Key darf nie ins Client-Bundle.** Alle TMDB-Calls laufen über eigene
   Route Handler unter `src/app/api/tmdb/**/route.ts`. Kein `NEXT_PUBLIC_TMDB_*`.
2. **Alterssicherung ist nicht verhandelbar (FEATURES.md 4.6).** Personen unter 18
   und Personen **ohne** `birthday` werden serverseitig herausgefiltert, bevor die
   Response den Client erreicht. Der Filter gehört in *eine* Funktion, die jede
   Route durchläuft — nicht in die UI.
   → Achtung, das ist der eigentliche Knackpunkt: `/search/person` und
   `/person/popular` liefern **kein** `birthday`. Du musst die Kandidaten mit
   `/person/{id}` (oder `append_to_response`) anreichern, bevor du filtern kannst.
   Das bedeutet N+1 Requests pro Seite — parallelisiert, mit Concurrency-Limit und
   serverseitigem Cache. Lös das sauber, nicht mit einem Kommentar "TODO".
   `adult: true` fliegt ebenfalls raus.
3. **Keine neuen Runtime-Dependencies.** `fetch` reicht. Kein axios, kein SWR,
   kein TMDB-SDK.
4. **Sprache & Stil**: UI-Strings deutsch, Code-Kommentare deutsch (siehe bestehende
   Dateien — knapp, erklären das *Warum*, nicht das *Was*). Bestehende Tailwind-Tokens
   nutzen (`surface-0/1/2`, `ink`, `dim`, `line`, `fuck`/`marry`/`kill`, `.card`,
   `.display`, `.eyebrow`, `.muted`, `.spine`). Keine neuen Farben erfinden.
5. **TMDB-Attribution** (4.3): sichtbarer Hinweis "Diese Anwendung nutzt die TMDB-API,
   ist aber nicht von TMDB unterstützt oder zertifiziert." + TMDB-Logo-Link auf der
   Promi-Seite.

## Umsetzung

### 1. Server-Layer

`src/lib/tmdb/` (neu, server-only — mit `import 'server-only'` absichern):

- `types.ts` — schmale Typen für das, was wir wirklich brauchen
  (`TmdbPersonSummary`, `TmdbPersonDetail`), nicht die volle API-Shape.
- `client.ts` — `tmdbFetch(path, params)`: Base-URL `https://api.themoviedb.org/3`,
  Key aus `process.env.TMDB_API_KEY`, `language=de-DE`, Timeout via `AbortSignal`,
  `next: { revalidate: 86400 }` fürs Caching. Wirft einen typisierten Fehler bei
  401 (Key fehlt/falsch), 429 (Rate-Limit) und Netzwerkfehlern.
- `safety.ts` — `isAllowed(detail)`: `birthday` vorhanden, Alter ≥ 18 (zum
  `deathday` bzw. heute gerechnet), `adult === false`. Plus
  `enrichAndFilter(summaries)` mit Concurrency-Limit (z.B. 8 parallel).
- `mapping.ts` — TMDB → App-Modell: `gender` (0 unspecified, 1 female, 2 male,
  3 nonbinary), `known_for_department` → passende Premade-Kategorie-ID
  (`Acting` → `premade-actors`, `Directing`/`Production` → `premade-actors` oder
  keine, `Sound`/`Music` → `premade-musicians`; alles andere ohne Kategorie),
  `profile_path` → volle Bild-URL (`https://image.tmdb.org/t/p/w342{path}` für die
  Grid-Vorschau, `w500` für den Download).
- `packs.ts` — Pack-Definitionen (4.1). Start mit 4–6 Packs, jedes ist eine
  Kombination aus TMDB-Endpoint + Query-Params, z.B. „Beliebt aktuell"
  (`/person/popular`), „Schauspiel" / „Musik" / „Regie" (`/discover` bzw.
  `/person/popular` + Department-Filter), „Legenden" (Popularität + Geburtsjahr
  vor 1970). Pack = `{ id, name, description, fetch(page) }`. Ehrlich sein: wenn
  ein Pack sich mit der TMDB-API nicht sinnvoll bauen lässt, lass es weg statt es
  clientseitig zu faken.

### 2. Route Handler

- `GET /api/tmdb/search?q=&page=` → gefilterte Personenliste + `page`, `totalPages`.
- `GET /api/tmdb/packs` → Metadaten aller Packs (ohne Personen).
- `GET /api/tmdb/packs/[packId]?page=` → gefilterte Personen des Packs.
- `GET /api/tmdb/person/[id]` → Detail einer Person (für die Detail-/Bestätigungs-Ansicht).

Alle: `export const runtime = 'nodejs'`, saubere Statuscodes, JSON-Fehler in der Form
`{ error: { code, message } }`. Fehlender `TMDB_API_KEY` → `503` mit einem Code, den
die UI in einen verständlichen Setup-Hinweis übersetzt (Verweis auf
`.env.local.example`), **nicht** in einen roten Crash.

### 3. Bild-Download

Bild-Bytes werden im Client geholt und über `processPhoto` → `savePhoto` in den
`photos`-Store gelegt, damit der Promi offline genau wie ein eigener Eintrag
funktioniert. `image.tmdb.org` liefert CORS-Header — prüf das; falls es im Browser
doch blockiert, bau `GET /api/tmdb/image?path=` als schlanken Proxy (nur Pfade, die
auf `/t/p/w500/...` matchen — keine offene Fetch-Relay-Route).

Im Such-Grid werden die Bilder **nicht** heruntergeladen, sondern direkt als
`<img src="https://image.tmdb.org/t/p/w185...">` gehängt. Erst beim Übernehmen wird
gespeichert.

### 4. Client-Layer

- `src/lib/db/celebrities.ts` (neu):
  - `findEntryByTmdbId(tmdbId)` — für Dedupe.
  - `importCelebrity({ tmdbId, name, gender, profileUrl, note }, { listIds })` —
    lädt das Bild, verarbeitet es, legt den `EntryRecord` mit `isCelebrity: true`
    an, hängt Premade-Kategorie und Listen-Mitgliedschaften dran. Idempotent: ist
    die `tmdbId` schon da (auch soft-deleted), wird der Eintrag reaktiviert/
    aktualisiert statt dupliziert.
  - `importCelebritiesBulk(...)` — für „ganzes Pack übernehmen", eine Transaktion,
    Bilder sequenziell mit Fortschritts-Callback.
- **DB-Migration:** `DB_VERSION` auf `2` hochziehen und im `upgrade`-Block einen
  Index `by-tmdbId` auf `entries` anlegen (`tmdbId` ist number → indizierbar;
  Records ohne `tmdbId` fallen aus dem Index, das ist gewollt). Schema-Typ in
  `FmkDB` mitziehen. Der bestehende `if (oldVersion < 1)`-Block bleibt unangetastet.

### 5. UI — `src/app/celebrities/page.tsx`

`'use client'`. Aufbau:

- `PageHeader` wie gehabt.
- Zwei Tabs / Segmented Control: **Suche** und **Packs**.
- Suche: Input mit Debounce (~350 ms), Ergebnis-Grid (Bild, Name, bekannt für,
  Geburtsjahr). Leerer Query → keine Requests.
- Packs: Karten-Liste der Packs; Klick öffnet das Pack-Grid mit „Mehr laden"
  (Pagination) und einem „Alle übernehmen"-Button.
- Jede Karte hat einen Übernehmen-Button. Vor dem Import: kleines Sheet/Modal zur
  Auswahl der Zielliste(n) (`listLists()`), mit der Option, eine neue Liste anzulegen.
  Die zuletzt gewählte Liste in `localStorage` merken.
- Zustände sauber abbilden: Laden (`Loading`), leer (`EmptyState`), Fehler und
  fehlender Key (`Notice`). Bereits importierte Promis sind im Grid als „In deiner
  Sammlung" markiert und nicht doppelt importierbar.
- Attribution im Footer der Seite.

### 6. Anbindung an den Rest

- `/entries` (`src/app/entries/page.tsx`): Filter „Nur eigene / Nur Promis / Alle"
  ergänzen, `isCelebrity` wird bisher nirgends genutzt.
- `poolBuilder`: `PoolConfig` um ein optionales Feld für die Promi-Herkunft
  erweitern (4.5 Mixed Mode), inkl. `describePool`-Text. `isPoolConfig` mit
  anpassen — die Funktion validiert persistierte Configs, also abwärtskompatibel
  bleiben (fehlendes Feld = Default, kein Reject).

## Nicht in Scope

Supabase/Sync, Auth, Pack-Auto-Refresh im Hintergrund (4.4), Monetarisierung.
Wenn dir dabei etwas auffällt, schreib es ans Ende von `FEATURES.md` statt es zu bauen.

## Abnahme

Am Ende muss gelten:

- `npm run build` läuft ohne TS- oder Lint-Fehler durch.
- `grep -r "TMDB_API_KEY" .next/static` findet nichts.
- Ohne gesetzten Key startet die App und `/celebrities` zeigt einen verständlichen
  Setup-Hinweis statt eines Fehlers.
- Suche nach einem bekannten Namen liefert Treffer mit Bild; Übernehmen erzeugt
  einen Eintrag, der unter `/entries` mit Foto auftaucht und in `/play` gespielt
  werden kann.
- Zweimal denselben Promi übernehmen erzeugt keinen zweiten Eintrag.
- Eine Person ohne `birthday` in TMDB taucht in keinem Ergebnis auf — schreib dafür
  einen kleinen Unit-Test gegen `safety.ts` mit Fixtures (kein Netzwerk).
- Bestehende IndexedDB-Daten überleben die Migration auf Version 2.

## Arbeitsweise

Erst einen kurzen Plan (Dateien + Reihenfolge) zeigen, dann in dieser Reihenfolge
bauen: Server-Layer → Routes → DB/Import → UI → Anbindung. Nach jedem Block
`npm run build`. Bestehende Konventionen kopieren, keine Refactorings nebenbei.
