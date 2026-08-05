# Aufgabe: Spielbildschirm passt am Handy nicht auf den Schirm

Projekt `fmk-web` (Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3).
Lies `src/app/play/page.tsx`, `src/components/game/RoundCard.tsx` und
`src/components/game/ActionZone.tsx`, bevor du etwas änderst.

## Problem

Am Handy sind die drei Aktions-Buttons (Fuck / Marry / Kill) nicht sichtbar — man
muss erst scrollen. Das ist der Kern des Spiels: Karte antippen, Aktion wählen.
Wenn beides nicht gleichzeitig auf dem Schirm ist, ist die Schleife kaputt.

Ursache ist die Höhe. In `page.tsx` steht `grid grid-cols-1 gap-3 sm:grid-cols-3` —
unterhalb des `sm`-Breakpoints stapeln sich die drei Karten also **untereinander**.
Jede Karte bringt `p-5`, einen 112 px-Avatar (`h-28 w-28`), Namen und Label mit,
macht grob 230 px pro Karte. Dazu der Header mit Descriptor, „Runde N" in
`text-4xl`, Spine und Statistikzeile. Zusammen deutlich mehr als ein
Handy-Viewport hergibt.

## Ziel

Auf einem Handy-Viewport (≈ 390 × 660 px, iPhone-Größe) sind **ohne Scrollen**
gleichzeitig sichtbar: die drei Karten, die drei Aktionszonen und der
„Runde abschließen"-Button.

## Lösungsrichtung

### 1. Karten am Handy nebeneinander statt untereinander

`grid-cols-1 sm:grid-cols-3` → durchgehend `grid-cols-3`. Drei schmale Karten
nebeneinander sind auf einem Handy die richtige Form für diese Entscheidung —
man vergleicht drei Personen, das will man nebeneinander sehen, nicht scrollend
nacheinander.

Dafür muss `RoundCard` schrumpfen:

- Padding `p-5` → am Handy deutlich kleiner (`p-2.5`), ab `sm:` wieder großzügig.
- Avatar `h-28 w-28 text-7xl sm:h-32 sm:w-32` → am Handy etwa `h-16 w-16` mit
  passend kleinerer Initialen-Schrift, ab `sm:` wie bisher. Der Avatar skaliert
  über `text-*` mit, siehe `InitialsAvatar`.
- Name `text-lg` → am Handy kleiner, `line-clamp-2` behalten. Lange Namen sind
  in einer Drittel-Spalte der Normalfall, nicht die Ausnahme.
- `gap-4` → am Handy enger.

Prüf das mit einem langen Namen (z. B. „Benedict Cumberbatch"), nicht nur mit
„Max".

### 2. Header auf `/play` zusammenstreichen

Der Header kostet am Handy zu viel Höhe für das, was er liefert. Am Handy
reichen Rundennummer und Descriptor in einer kompakten Zeile; Spine, große
`display`-Überschrift und die Kombinationen-Statistik erst ab `sm:` einblenden.
Der Ton-Schalter bleibt erreichbar, darf aber schrumpfen.

### 3. Sekundäre Aktionen entlasten

„Rückgängig" und „Neu mischen" konkurrieren mit „Runde abschließen" um Platz.
Am Handy: primärer Button volle Breite, die beiden anderen als kompakte
Icon- oder Kurztext-Buttons in einer Zeile darunter. Ab `sm:` wie bisher
nebeneinander.

### 4. Höhe robust messen

Falls du eine Viewport-Höhe brauchst: `dvh` statt `vh`. Mobile Browser blenden
ihre Adressleiste ein und aus — `100vh` ist dort schlicht falsch und erzeugt
genau das Scrollen, das wir loswerden wollen.

## Nebenbefund: Drag & Drop funktioniert am Handy gar nicht

`RoundCard` nutzt `draggable` mit `onDragStart`, `ActionZone` entsprechend
`onDrop`. Die HTML5-Drag-and-Drop-API feuert auf Touch-Geräten nicht — am Handy
funktioniert also **nur** der Weg „Karte antippen, dann Aktion antippen".

Der Hinweistext verspricht aber beides:

> Karte antippen, dann Aktion wählen — oder Karte auf die Aktion ziehen

Das ist am Handy eine Lüge und lässt Nutzer glauben, etwas sei kaputt. Minimal
korrekt wäre, den Zieh-Teil nur ab `sm:` einzublenden.

Bau in diesem Auftrag **keine** Touch-Drag-Implementierung — das ist ein eigenes
Vorhaben (Pointer Events, eigenes Hit-Testing). Notier es stattdessen am Ende von
`FEATURES.md` unter den offenen Punkten.

## Randbedingungen

- **Keine neuen Dependencies.**
- Nur bestehende Tailwind-Tokens (`surface-0/1/2`, `ink`, `dim`, `line`,
  `fuck`/`marry`/`kill`, `.card`, `.display`, `.eyebrow`, `.muted`, `.spine`).
  Keine neuen Farben, keine neuen Schriftgrößen-Skalen.
- Mobile-first: die kleinen Werte sind der Default, `sm:`/`md:` bauen darauf auf.
  Nicht umgekehrt.
- Desktop darf sich **nicht** verschlechtern. Ab `sm:` soll das Layout aussehen
  wie bisher.
- UI-Strings deutsch, Kommentare deutsch und knapp.
- Keine Refactorings nebenbei. Das ist eine Layout-Korrektur.

## Abnahme

- `npm run build` und `npm test` laufen fehlerfrei durch.
- Bei 390 × 660 px sind Karten, Aktionszonen und „Runde abschließen" ohne
  Scrollen sichtbar.
- Bei 360 × 640 px (kleines Android) ebenfalls — das ist der harte Fall.
- Antippen einer Karte und danach einer Aktionszone funktioniert unverändert,
  inklusive Auswahl-Ring und Verdict-Einfärbung.
- Ein Name mit 20+ Zeichen sprengt die Karte nicht.
- Ab `sm:` ist das Layout unverändert zum Vorherzustand.
- Der Zieh-Hinweis erscheint nicht mehr auf Touch-Breakpoints.

## Arbeitsweise

Erst kurzer Plan, dann bauen: `RoundCard` → Grid in `page.tsx` → Header →
Button-Zeile → Hinweistext. Nach jedem Block `npm run build`. Am Ende die
Viewport-Größen oben durchgehen und ehrlich melden, wenn eine davon nicht passt,
statt die Abnahme schönzureden.
