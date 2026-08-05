# Aufgabe: Navigation von 7 auf 3 Punkte reduzieren

Projekt `fmk-web` (Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3).
Lies `src/components/Nav.tsx` und die betroffenen Seiten, bevor du etwas änderst.

## Problem

Die Hauptnavigation hat sieben Einträge: Start, Spielen, Einträge, Listen, Verlauf,
Promis, Einstellungen. Für eine App mit im Grunde zwei Tätigkeiten — spielen und
Einträge pflegen — ist das zu viel, besonders im mobilen Off-Canvas-Menü.

Sortiert man nach Rolle, fällt es auseinander:

- **Start** ist redundant, das Logo führt schon dorthin.
- **Listen** und **Promis** sind keine eigenen Bereiche, sondern zwei Wege, an
  Einträge zu kommen. Promis ist eine *Quelle*, kein Ort.
- **Einstellungen** gehört hinter ein Icon, nicht in die Hauptnavigation.

## Zielzustand

Hauptnavigation: **Spielen · Einträge · Verlauf**

- Logo links = Start (`/`), bleibt wie es ist.
- Rechts im Header: Theme-Toggle (existiert) + **neues Zahnrad-Icon** → `/settings`.
- Unter `/entries` eine Sub-Navigation mit drei Tabs: **Meine · Listen · Promis**.
- Am Handy: **Bottom-Tab-Bar** mit den drei Hauptpunkten statt Hamburger-Menü.
  Das Off-Canvas-Panel und `menuOpen` fliegen komplett raus.

## Wichtig: keine Routen umbauen

`/lists`, `/lists/[id]`, `/celebrities` und `/settings` bleiben als Routen genau
dort, wo sie sind. Die Tabs sind nur eine gemeinsame Sub-Navigation, die auf
mehreren Seiten gerendert wird. Damit bleiben Deep-Links, Browser-Zurück und
bestehende `<Link>`-Verweise im Code intakt, und der Umbau ist auf die
Navigations-Komponenten begrenzt.

Falls du irgendwo einen `<Link href="/celebrities">` oder `/lists` findest, der
durch den Umbau ins Leere zeigt: nicht löschen, sondern prüfen, ob er noch Sinn
ergibt.

## Umsetzung

### 1. `src/components/Nav.tsx` umbauen

- `LINKS` auf drei Einträge reduzieren: `/play` „Spielen", `/entries` „Einträge",
  `/history` „Verlauf".
- **Aktiv-Zustand korrigieren.** Die bestehende `isActive`-Logik nutzt
  `pathname.startsWith(href)`. Damit „Einträge" auch auf `/entries/new`,
  `/entries/[id]/edit`, `/lists`, `/lists/[id]` und `/celebrities` aktiv
  aussieht, brauchst du eine Zuordnung von Pfad-Präfix → Nav-Punkt. Bau das als
  explizite Tabelle, nicht als verschachtelte Bedingungen.
- Zahnrad-Button rechts neben dem Theme-Toggle, gleiche `iconButton`-Klasse,
  `aria-label="Einstellungen"`, `aria-current="page"` wenn `/settings` aktiv ist.
  SVG im Stil der vorhandenen `ThemeIcon`-Pfade (20×20 viewBox, `stroke="currentColor"`,
  `strokeWidth="1.5"`) — kein Icon-Paket installieren.
- Hamburger-Button, Off-Canvas-Panel, `menuOpen`-State, Scroll-Lock,
  Escape-Handler und der `DESKTOP_QUERY`-Effekt entfallen ersatzlos. Achte
  darauf, dass keine verwaisten Imports (`useRef`, `useState`, `useEffect`)
  stehen bleiben.
- Die Inline-Navigation im Header bleibt, aber erst ab `md:` sichtbar — darunter
  übernimmt die Bottom-Bar.

### 2. Neue Komponente `src/components/BottomNav.tsx`

- Nur unterhalb `md` sichtbar (`md:hidden`), `fixed inset-x-0 bottom-0 z-30`,
  `border-t border-line bg-surface-0/95 backdrop-blur`.
- Drei gleich breite Tabs, jeweils Icon über Label. Icons im selben SVG-Stil wie
  oben — ein Würfel/Karten-Symbol für Spielen, Personen für Einträge, Uhr für
  Verlauf. Halte sie schlicht, sie sind 20×20.
- Aktiver Tab: `text-ink` + die vorhandene `.spine`-Leiste als dünner Balken
  **oben** an der Kachel (nicht unten — unten sitzt der Bildschirmrand).
  Inaktiv: `text-dim`.
- `aria-current="page"` am aktiven Link. Die `<nav>` bekommt ein
  `aria-label="Hauptnavigation"`.
- **iOS-Notch:** `padding-bottom: env(safe-area-inset-bottom)` ergänzen, sonst
  klebt die Leiste auf dem Home-Indicator. Am einfachsten über eine kleine
  Utility-Klasse in `globals.css`.
- Im `layout.tsx` unterhalb des `<main>` einhängen und dem Content
  `pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0` geben, damit die
  letzte Zeile jeder Seite nicht unter der Leiste verschwindet.
- **Auf `/play` wird die Bottom-Bar ausgeblendet.** Das Spiel soll den ganzen
  Schirm haben, und die Action-Zonen liegen unten — eine Leiste darüber wäre eine
  Fehlklick-Falle.

### 3. Neue Komponente `src/components/EntriesTabs.tsx`

- Segmented Control mit drei Links: `/entries` „Meine", `/lists` „Listen",
  `/celebrities` „Promis".
- Wird gerendert auf `/entries`, `/lists`, `/lists/[id]` und `/celebrities`,
  jeweils direkt unter dem `PageHeader`. Auf `/entries/new` und
  `/entries/[id]/edit` **nicht** — das sind Formulare, keine Übersichten.
- Aktiver Tab per `usePathname`, `aria-current="page"`.
- Optisch am Stil der App bleiben: `rounded-xl border border-line`, aktiver Tab
  `bg-surface-2 text-ink font-semibold`, inaktiv `text-dim hover:text-ink`.
  Keine neuen Farben.

### 4. Startseite ergänzen

`src/app/page.tsx` hat bereits Modus-Karten. Weil Promis jetzt eine Ebene tiefer
liegt, braucht es dort einen sichtbaren Einstieg: eine Karte „Promis" im
bestehenden `MODE_CARD`-Stil, die nach `/celebrities` führt. Formulierung im Ton
der Seite, kein Marketing-Sprech.

## Randbedingungen

- **Keine neuen Dependencies.** Icons als Inline-SVG.
- UI-Strings deutsch, Code-Kommentare deutsch, knapp, erklären das *Warum*.
- Nur bestehende Tailwind-Tokens (`surface-0/1/2`, `ink`, `dim`, `line`,
  `fuck`/`marry`/`kill`, `.card`, `.display`, `.eyebrow`, `.muted`, `.spine`).
- Keine Refactorings nebenbei. Das ist ein Navigations-Umbau, sonst nichts.

## Abnahme

- `npm run build` und `npm test` laufen fehlerfrei durch.
- Header zeigt genau drei Nav-Punkte plus zwei Icons rechts.
- `Nav.tsx` enthält kein `menuOpen`, kein Off-Canvas-Markup mehr.
- Auf `/entries/new` ist „Einträge" im Header als aktiv markiert, auf
  `/celebrities` und `/lists/xyz` ebenfalls.
- Am Handy (Viewport < 768 px): Bottom-Bar sichtbar, kein Hamburger, kein
  Inhalt wird von der Leiste verdeckt. Auf `/play` keine Bottom-Bar.
- Tastaturbedienung: durchtabbar, Fokus sichtbar, keine Fokusfallen.
- Alle vier Ziel-Routen der Tabs sind weiterhin direkt aufrufbar.

## Arbeitsweise

Erst kurzer Plan (Dateien + Reihenfolge), dann bauen: `Nav.tsx` → `BottomNav.tsx`
→ `EntriesTabs.tsx` → Einbindung in die Seiten → Startseiten-Karte. Nach jedem
Block `npm run build`.
