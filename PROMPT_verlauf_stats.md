# Aufgabe: Verlauf ausbauen — Chronik und Rangliste

Projekt `fmk-web` (Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3,
IndexedDB via `idb`). Lies `src/app/history/page.tsx`, `src/lib/db/rounds.ts`,
`src/lib/db/schema.ts` und `src/lib/theme/SettingsProvider.tsx`, bevor du etwas
änderst.

## Ist-Zustand

`/history` zeigt eine einzige Zahl — gespielte Runden — und einen Platzhaltertext,
der Statistiken für „Phase 3" ankündigt. Die Daten liegen längst vollständig vor:
`rounds` (mit `playedAt`, `listId`, `poolDescriptor`) und `roundItems` (mit
`entryId`, `verdict`, `position`, Indizes `by-round` und `by-entry`).

## Ziel

Zwei Ansichten unter `/history`, als Tabs:

- **Rangliste** — wer wird am häufigsten gefickt / geheiratet / gekillt.
- **Chronik** — welche Runde wann, mit welchen drei Namen und welchem Urteil
  (FEATURES.md 1.6, bisher nie gebaut).

Die Kennzahl „gespielte Runden" bleibt sichtbar.

## Der Fallstrick: absolute Zahlen ranken das Falsche

Das ist der Kern der Aufgabe, bau es nicht naiv.

Eine Rangliste nach absoluten Zählern misst nicht Beliebtheit, sondern
Anwesenheit: Wer 30-mal gezogen wurde, sammelt zwangsläufig mehr „Marry" als
jemand mit 3 Auftritten. Rankt man dagegen nach Quote, gewinnt jeder, der einmal
gezogen und einmal geheiratet wurde, mit 100 %.

**Die Regel:**

- Sortiert wird nach **Quote** (Anteil eines Verdicts an den eigenen Auftritten).
- Es gilt eine **Mindestzahl an Auftritten**, unterhalb derer ein Eintrag nicht
  gerankt wird. Start: 3. Als benannte Konstante, nicht als magische Zahl.
- Angezeigt werden **immer beide Zahlen**: „4 von 5 · 80 %". Eine Quote ohne
  ihre Grundgesamtheit ist nicht nachvollziehbar.
- Gleichstand: nach absoluter Anzahl, dann alphabetisch. Deterministisch, damit
  die Reihenfolge nicht bei jedem Rendern springt.
- Sind zu wenige Einträge über der Schwelle, zeigt die Rangliste einen
  `EmptyState` mit dem Hinweis, wie viele Runden noch fehlen — nicht eine leere
  Tabelle.

## Umsetzung

### 1. Auswertungslogik als reine Funktionen

Neu: `src/lib/stats/leaderboard.ts` — **ohne** IndexedDB-Zugriff, ohne
Netzwerk. Nimmt fertig geladene `RoundItemRecord[]` und `EntryRecord[]` entgegen
und gibt die ausgewertete Struktur zurück.

Der Grund ist derselbe wie bei `src/lib/tmdb/safety.ts`: So ist die Regel mit
Fixtures testbar, ohne Browser und ohne Datenbank. Halte diese Trennung ein.

Enthalten sein sollten:

- `buildStats(items, entries)` → pro Eintrag: Auftritte, Zähler je Verdict,
  Quoten je Verdict.
- `rankBy(stats, verdict, minAppearances)` → sortierte Liste nach obiger Regel.
- `findNeverMarried(stats, minAppearances)` → oft gezogen, kein einziges Marry.
- `findMostPolarising(stats, minAppearances)` → möglichst gleichmäßige
  Verteilung über alle drei Urteile.

### 2. Datenzugriff

Neu in `src/lib/db/rounds.ts` (oder einer eigenen `stats.ts`, wenn `rounds.ts` zu
voll wird): eine Funktion, die alle `roundItems` und die zugehörigen Einträge
lädt, optional gefiltert nach `listId`.

**Nicht optimieren.** Ein `getAll('roundItems')` und Gruppieren im Speicher ist
hier richtig — die Datenmengen sind klein, und der Schema-Kommentar zieht diese
Linie bereits bewusst.

### 3. Seite `/history` umbauen

**Kopfbereich:** Die vorhandene große Zahl bleibt. Daneben zwei weitere
Kennzahlen, die ihr Kontext geben: Einträge, die überhaupt schon einmal im Spiel
waren, und die Zahl möglicher Kombinationen (`totalTriples` existiert in
`src/lib/game/roundGenerator.ts`).

**Tabs „Rangliste" / „Chronik".** Orientier dich an der Segmented-Control-Optik
von `src/components/EntriesTabs.tsx` — das ist dasselbe Muster, aber mit lokalem
State statt Routen. Kein neuer visueller Stil.

**Rangliste:**

- **Podest**: drei Karten in den Verdict-Farben (`VERDICT_THEME` in
  `src/components/game/verdictTheme.ts`), jeweils Platz 1 mit `EntryAvatar`,
  Name und „4 von 5 · 80 %".
- **Volle Tabelle** darunter: alle gerankten Einträge. Pro Zeile Avatar, Name,
  Auftritte — und die Verteilung als **gestapelter Balken** in den drei
  Verdict-Farben, Breite proportional zu den Anteilen.

  Das ist reines CSS (drei `<div>` mit Prozentbreiten in einem Flex-Container),
  **keine Chart-Bibliothek**. Der Balken braucht eine textliche Entsprechung für
  Screenreader — die Zahlen dürfen nicht nur in der Grafik stecken.
- Umschalter, nach welchem Verdict sortiert wird.
- Darunter die Kuriositäten: „Nie geheiratet" und „Polarisierend", je eine
  kompakte Zeile. Nur anzeigen, wenn es einen Treffer gibt.

**Chronik:**

- Runden absteigend nach `playedAt`, neueste zuerst. Der Index `by-playedAt`
  existiert.
- Pro Runde: Datum, `poolDescriptor`, und die drei Namen mit ihrem Urteil in der
  jeweiligen Farbe.
- Bei vielen Runden nicht alles auf einmal rendern — „Mehr laden" in Schritten
  von 25.

**Filter nach Liste** über beiden Tabs: `rounds.listId` liegt vor. Sobald eigene
Einträge und Promis gemischt gespielt wurden, ist eine Gesamtrangliste über alles
wenig aussagekräftig. Default: alle Runden.

## Was dabei leicht vergessen wird

**Safe Labels.** In den Einstellungen gibt es den Schalter auf „Date / Marry /
Dump". Sämtliche Verdict-Beschriftungen im Verlauf müssen über
`useVerdictLabels()` laufen. Keine festen Strings „Fuck"/"Marry"/"Kill" im
Markup.

**Gelöschte Einträge.** Der Soft-Delete hält die Historie absichtlich intakt —
gelöschte Personen kommen in alten Runden vor. Sie müssen **mitgezählt** und
ausgegraut mit einem Hinweis markiert werden. Filterst du sie still heraus,
stimmen die Summen nicht mehr mit den gespielten Runden überein und niemand
versteht warum. `listEntries`-Aufrufe in `entries.ts` filtern standardmäßig
gelöschte heraus — hier brauchst du `includeDeleted: true`.

**Einträge ohne Auftritte** gehören nicht in die Rangliste. Nur wer gespielt
wurde, wird bewertet.

## Randbedingungen

- **Keine neuen Dependencies.** Kein Chart.js, kein recharts.
- Nur bestehende Tailwind-Tokens (`surface-0/1/2`, `ink`, `dim`, `line`,
  `fuck`/`marry`/`kill`, `.card`, `.display`, `.eyebrow`, `.muted`, `.spine`,
  `.chip`) und `VERDICT_THEME`. Keine neuen Farben.
- Mobile-first. Die Tabelle muss bei 360 px Breite lesbar bleiben — im Zweifel
  wird die Zeile zweizeilig, statt horizontal zu scrollen.
- UI-Strings deutsch, Kommentare deutsch und knapp, erklären das *Warum*.
- Keine Schema-Migration. Es werden ausschließlich vorhandene Daten ausgewertet.
- Keine Refactorings nebenbei.

## Abnahme

- `npm run build` und `npm test` laufen fehlerfrei durch.
- **Neuer Unit-Test `tests/leaderboard.test.ts`** mit Fixtures, kein Netzwerk,
  keine DB — analog zu `tests/safety.test.ts`. Muss abdecken:
  - Quote schlägt absolute Zahl: 3 von 3 rankt vor 5 von 20.
  - Die Mindestauftritts-Schwelle greift: 1 von 1 taucht nicht auf.
  - Gleichstand wird deterministisch aufgelöst.
  - Einträge ohne Auftritte kommen nicht vor.
  - „Nie geheiratet" findet den richtigen, „Polarisierend" ebenfalls.
- Mit den vorhandenen 9 Runden zeigt die Seite echte Zahlen, keine Platzhalter.
- Umschalten der Safe Labels in den Einstellungen ändert die Beschriftungen im
  Verlauf mit.
- Ein soft-gelöschter Eintrag erscheint weiterhin in Chronik und Rangliste,
  erkennbar markiert.
- Der Platzhalter-`Notice` („kommen in Phase 3") ist weg.
- Bei 360 px Breite ist nichts abgeschnitten.

## Arbeitsweise

Erst kurzer Plan, dann bauen: `leaderboard.ts` mit Tests → Datenzugriff →
Kopfbereich und Tabs → Rangliste → Chronik → Listenfilter. Nach jedem Block
`npm run build`.

Fang mit den Tests an, nicht mit der Optik. Die Rangregel ist der Teil, der
falsch werden kann; das Layout ist der Teil, den man sofort sieht.
