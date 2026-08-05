# Aufgabe: Promi-Kategorien richtig zuordnen (Wikidata-Vorschlag + freie Auswahl)

Projekt `fmk-web` (Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3).
Lies `src/lib/tmdb/mapping.ts`, `src/lib/tmdb/client.ts`, `src/lib/tmdb/enrich.ts`,
`src/lib/db/celebrities.ts` und `src/components/celebrities/ImportSheet.tsx`,
bevor du etwas änderst.

## Problem

Importiert man Cristiano Ronaldo, landet er in der Kategorie **Actors**. Er ist
Fußballer.

Die Ursache liegt in den Daten, nicht im Code: TMDB kennt kein Berufsfeld. Das
Feld `known_for_department` beschreibt die Rolle *in einer Filmproduktion* —
Acting, Directing, Sound, Camera. Ronaldo steht dort auf „Acting", weil er in
Dokumentationen vorkommt. `mapping.ts` leitet daraus brav „Actors" ab. Aus TMDB
allein ist es nicht besser lösbar.

Eine falsche Kategorie ist dabei schlimmer als gar keine: Sie wirkt still weiter.
Wer später einen Pool „nur Actors" baut, bekommt Ronaldo hineingemischt und merkt
es nicht.

## Ziel

1. Der Kategorie-Vorschlag kommt aus **Wikidata** (echter Beruf) statt aus dem
   TMDB-Department.
2. Der Vorschlag ist eine **Vorbelegung, keine Vorschrift** — im Import-Dialog
   frei änderbar.
3. Weiß niemand etwas, wird **keine** Kategorie gesetzt. Nie geraten.

## Warum Wikidata hier billig ist

TMDB liefert die Wikidata-ID selbst mit: `/person/{id}` mit
`append_to_response=external_ids` gibt neben IMDb und Instagram auch
`wikidata_id` zurück (z. B. `Q11571`). Kein Suchen, kein Zuordnen, **kein
zusätzlicher TMDB-Request** — das hängt sich an den Detail-Call, den `enrich.ts`
ohnehin macht.

Wikidata selbst braucht **keinen Key und keinen Account**, die Daten sind CC0.
TMDB bleibt unverändert die Quelle für Name, Foto und Geburtsdatum. Wikidata
beantwortet ausschließlich die Frage „welchen Beruf hat diese Person".

## Umsetzung

### 1. TMDB-Detail um `external_ids` erweitern

In `client.ts` beim Person-Detail `append_to_response=external_ids` mitgeben und
`wikidata_id` in `TmdbPersonDetail` (siehe `types.ts`) aufnehmen — optional, das
Feld fehlt bei vielen Personen.

### 2. Neues Modul `src/lib/wikidata/`

- `client.ts` — ein GET, server-seitig, gleicher Stil wie `tmdb/client.ts`
  (Timeout via `AbortSignal`, `next: { revalidate: ... }`, typisierte Fehler).

  **Nimm den schlanken Endpunkt**, nicht `Special:EntityData/{Q}.json` — der
  liefert das komplette Entity-Dokument und ist für einen Beruf grotesk groß:

  ```
  https://www.wikidata.org/w/api.php?action=wbgetclaims&entity={Q}&property=P106&format=json
  ```

  **Pflicht:** Wikimedia verlangt einen aussagekräftigen `User-Agent`-Header mit
  Projektname und Kontaktmöglichkeit. Ohne den riskierst du eine Sperre. Setz ihn
  als Konstante mit erklärendem Kommentar.

- `occupations.ts` — handgepflegte Tabelle Q-ID → Kategorie-ID deiner sechs
  Premade-Kategorien (`premade-actors`, `premade-musicians`, `premade-athletes`,
  `premade-reality-tv`, `premade-anime`, `premade-politicians`). Startpunkte:
  `Q33999` Schauspieler, `Q937857` Fußballspieler, `Q177220` Sänger,
  `Q82955` Politiker, `Q2066131` Sportler. Recherchier die restlichen gängigen
  selbst und kommentier jede Zeile mit dem Klartextnamen — sonst ist die Tabelle
  in drei Monaten unlesbar.

  **Die Hierarchie nicht automatisch hochlaufen.** „Fußballspieler ist Unterklasse
  von Sportler" wäre elegant, kostet aber pro Person weitere Requests. Eine
  flache, ehrliche Tabelle ist hier die bessere Lösung.

- **Mehrere Berufe sind der Normalfall.** Ronaldo ist auch „Model" und
  „Unternehmer". Definier eine explizite **Prioritätsreihenfolge** über die
  Kategorien und nimm die erste passende — nicht „der erste Eintrag in der
  Antwort". Die Reihenfolge in P106 ist bedeutungslos.

- Cache analog zu `enrich.ts`: Map mit TTL und Größenbegrenzung. Berufe ändern
  sich praktisch nie, ein langer TTL ist richtig.

### 3. Wann Wikidata gefragt wird — wichtig

**Nicht** für jedes Suchergebnis. Eine Trefferliste mit 20 Personen würde 20
Wikidata-Requests auslösen, von denen 19 nie gebraucht werden.

Stattdessen: **nur für die eine Person, die gerade importiert werden soll.**
Öffnet der Nutzer das `ImportSheet`, holt es `/api/tmdb/person/{id}` — und diese
Route reichert um den Berufsvorschlag an. Das Such-Grid bleibt so schnell wie
jetzt.

**Wikidata-Fehler sind niemals fatal.** Timeout, 404, unbekannter Beruf, keine
`wikidata_id`: Ergebnis ist schlicht „kein Vorschlag". Der Import muss in jedem
dieser Fälle normal funktionieren. Kein Fehler-Banner, kein Blockieren.

### 4. `mapping.ts` entrümpeln

Die Ableitung `known_for_department` → Kategorie ersatzlos entfernen. Sie ist die
Fehlerquelle. `known_for_department` darf weiterhin als reine Anzeige-Information
(„bekannt für") in der Karte stehen — aber nichts mehr steuern.

### 5. `ImportSheet` um Kategorie-Auswahl erweitern

- Bestehende Komponente `src/components/lists/CategoryTagPicker.tsx`
  wiederverwenden, nicht neu bauen.
- Vorbelegt mit dem Wikidata-Vorschlag, falls vorhanden. Abwählbar.
- **Optional.** Ohne Auswahl wird der Eintrag ohne Kategorie angelegt — er bleibt
  über `isCelebrity` und den „Promi"-Chip auf `/entries` auffindbar.
- Wenn ein Vorschlag da ist, kennzeichne ihn dezent als Vorschlag (z. B. ein
  „vorgeschlagen"-Hinweis in `.eyebrow`-Stil), damit klar ist, dass er nicht vom
  Nutzer stammt.
- Die zuletzt gewählte Liste wird bereits gemerkt — die Kategorie **nicht**
  merken. Die ist personenabhängig, ein Merken würde nur falsche Vorbelegungen
  produzieren.

### 6. Bulk-Import („Alle übernehmen")

Hier **kein** Wikidata — das wären zu viele Requests auf einmal. Ein ganzes Pack
wird ohne Kategorien importiert. Nachträglich lassen sich die Einträge über
`/entries` normal bearbeiten.

Sag das in der UI ehrlich dazu, in einem knappen Satz. Nicht stillschweigend
anders verhalten als beim Einzelimport.

## Randbedingungen

- **Keine neuen Dependencies.** `fetch` reicht.
- Wikidata-Zugriff ausschließlich serverseitig, gleiche Struktur wie `tmdb/`.
- Keine Schema-Migration nötig — es werden nur bestehende
  `entryCategories`-Verknüpfungen anders befüllt. Falls du meinst, doch eine zu
  brauchen: erst begründen, nicht einfach machen.
- UI-Strings deutsch, Kommentare deutsch, knapp, erklären das *Warum*.
- Nur bestehende Tailwind-Tokens, keine neuen Farben.
- Das Age-Gate bleibt unangetastet. Wikidata darf daran nichts ändern und nichts
  umgehen — es liefert ausschließlich einen Kategorie-Vorschlag.

## Abnahme

- `npm run build` und `npm test` laufen fehlerfrei durch.
- **Ronaldo importieren → Vorschlag „Athletes", nicht „Actors".**
- Ein echter Schauspieler → Vorschlag „Actors".
- Eine Person ohne `wikidata_id` → kein Vorschlag, Import funktioniert trotzdem,
  Eintrag hat keine Kategorie.
- Wikidata künstlich abgeklemmt (falsche URL) → Import läuft weiter durch.
- Vorschlag lässt sich im Dialog abwählen und durch eine andere Kategorie
  ersetzen.
- Neuer Unit-Test für die Q-ID-Tabelle: bekannte ID → richtige Kategorie,
  mehrere Berufe → Prioritätsreihenfolge greift, unbekannte ID → `null`.
  Fixtures, kein Netzwerk — genau wie `tests/safety.test.ts`.
- Bestehende Promi-Einträge in der DB bleiben unverändert.

## Arbeitsweise

Erst kurzer Plan, dann bauen: `types.ts`/`client.ts` (external_ids) →
`wikidata/` → Person-Route → `mapping.ts` aufräumen → `ImportSheet` → Tests.
Nach jedem Block `npm run build`.

Melde am Ende ehrlich, welche Q-IDs du in die Tabelle aufgenommen hast und welche
gängigen Fälle noch fehlen — die Tabelle ist bewusst unvollständig und wächst mit
der Nutzung.
