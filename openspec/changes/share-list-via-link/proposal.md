## Why

Listen sind der Teil der App, in dem die eigentliche Arbeit steckt: Namen
eintippen, Fotos zuordnen, Kategorien pflegen. Wer zu dritt spielen will, muss
diese Arbeit heute auf jedem Gerät noch einmal machen — die Daten liegen
ausschließlich lokal in IndexedDB, es gibt keinen Weg nach draußen.

FEATURES.md 5.5 sieht das Teilen von Listen vor, ordnet es aber dem Sync-Kapitel
zu. Das braucht es nicht: eine Liste passt komprimiert in eine URL. Damit ist
Teilen ohne Konto, ohne Server und ohne Datenbank möglich — passend zu einer App,
die bewusst nichts speichert, was sie nicht muss.

## What Changes

**Teilen**

- Eine Liste lässt sich als Link ausgeben. Die Daten stecken komprimiert im
  **Fragment** der URL (hinter `#`) — der Teil, den Browser nie an einen Server
  schicken. Namen echter Personen verlassen damit das Gerät nur über den
  Messenger, den die teilende Person selbst wählt.
- Teilen über das System-Share-Sheet, mit „in die Zwischenablage" als Rückfall.
- Der Link enthält: Listenname, und je Eintrag Name, Geschlecht, Notiz,
  Kategorien sowie die TMDB-ID bei Promis. **Keine Fotos** — ein einziges Bild
  sprengt jede URL.
- Wird eine Liste zu groß für einen verlässlich teilbaren Link, sagt die App das
  vorher, statt einen Link zu erzeugen, der unterwegs abgeschnitten wird.

**Übernehmen**

- Ein geöffneter Link zeigt eine **Vorschau**: Listenname, Anzahl, die Namen —
  und welche davon es beim Empfänger schon gibt. Erst ein bewusster Klick
  schreibt etwas in die Datenbank.
- **Namensgleiche Einträge werden wiederverwendet**, nicht dupliziert: der
  vorhandene Eintrag wandert in die neue Liste und behält Foto und Notiz, die
  der Empfänger gepflegt hat.
- **Promi-Fotos werden nachgeladen.** Die TMDB-ID reist im Link mit, das Bild
  holt sich der Empfänger selbst. Dabei läuft die Alterssicherung (FEATURES.md
  4.6) erneut — ein geteilter Link kann sie nicht umgehen. Ohne Netz entsteht
  der Eintrag trotzdem, nur mit Initialen.
- Kategorien aus dem Link werden beim Empfänger angelegt, soweit sie fehlen.
  Premade-Kategorien haben stabile IDs und treffen sich von selbst.

**Nicht in diesem Change:** Konten und echter Sync (5.x), Fotoübertragung,
Export/Import als Datei (7.5), Änderungen an einer geteilten Liste, die beim
anderen ankommen. Ein Link ist eine Momentaufnahme, keine Verbindung.

## Capabilities

### New Capabilities

- `list-sharing`: Eine vorhandene Liste als Link ausgeben, der die Liste
  vollständig und ohne Server transportiert, inklusive der Grenzen, ab denen
  das nicht mehr verlässlich geht.
- `list-import`: Einen solchen Link einlösen — Vorschau, bewusste Übernahme,
  Zusammenführung mit vorhandenen Einträgen, und Abwehr von Links, die kaputt
  oder böswillig sind.

### Modified Capabilities

<!-- Keine — unter openspec/specs/ liegen noch keine Specs. -->

## Impact

**Neu**

- `src/lib/share/listPayload.ts` — Format, Kodierung, Dekodierung, Validierung
  (reine Funktionen, mit Fixtures testbar)
- `src/app/lists/import/page.tsx` — Vorschau und Übernahme
- `src/lib/db/listImport.ts` — der schreibende Teil (Einträge zusammenführen,
  Kategorien anlegen, Liste erstellen)
- `tests/listPayload.test.ts`

**Geändert**

- `src/app/lists/[id]/page.tsx` — Knopf „Liste teilen"
- Ggf. `src/lib/db/lists.ts` und `src/lib/db/entries.ts` um Lesefunktionen, die
  der Export braucht

**Wiederverwendet statt neu gebaut**

- `importCelebrity()` in `src/lib/db/celebrities.ts` — dedupliziert bereits über
  `tmdbId`, lädt das Foto und nimmt Soft-Deletes zurück
- `fetchCelebrity()` in `src/lib/celebrities/api.ts` — liefert die Bild-URL und
  schickt den Promi durch die Alterssicherung
- `findDuplicateNames()` in `src/lib/db/entries.ts` — die Namenserkennung, die
  schon die Duplikat-Warnung beim Anlegen speist

**Abhängigkeiten**: keine neuen npm-Pakete. Komprimiert wird mit
`CompressionStream('deflate-raw')`, das die Zielbrowser mitbringen.

**Datenschutz**: Das Fragment erreicht keinen Server — nicht den eigenen, nicht
den von Vercel, und es landet in keinem Zugriffslog. Wer den Link weiterleitet,
gibt die Namen trotzdem weiter; die App kann das nicht verhindern und soll es
beim Teilen benennen.
