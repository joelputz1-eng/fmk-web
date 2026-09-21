## Why

Die App ist funktional weit — Spielschleife, Einträge, Listen, Promi-Modus und
Verlauf stehen — aber sie läuft ausschließlich auf `localhost`. Es gibt keinen
Weg, sie an einem echten Abend zu benutzen: keine erreichbare URL, keine
Installation auf dem Homescreen, und am Handy lässt sich keine Karte ziehen,
weil das HTML5-Drag-API bei Touch nicht feuert.

Dieser Change macht aus dem Prototyp etwas Benutzbares: deployt, vom Handy aus
installierbar, und mit einer Kartenzuweisung, die sich am Telefon nicht kaputt
anfühlt.

## What Changes

**Deployment**

- Die App wird auf einer festen HTTPS-URL gehostet (Vercel), mit `TMDB_API_KEY`
  als serverseitiger Umgebungsvariable.
- `robots.txt` und Meta-Robots auf `noindex, nofollow` — öffentlich erreichbar,
  aber nicht auffindbar. Kein Zugangsschutz.
- Eine knappe Deploy-Anleitung im Repo, damit der Weg reproduzierbar bleibt.

**Installierbarkeit (PWA)**

- Web-App-Manifest mit Name, Farben, `display: standalone` und Start-URL.
- App-Icons (maskable + apple-touch-icon) aus der vorhandenen Bildsprache.
- Minimaler Service Worker: App-Shell offline verfügbar, Installations-Prompt
  in Chrome/Android möglich. Spielen ohne Netz muss funktionieren — die Daten
  liegen ohnehin lokal in IndexedDB. Promi-Packs bleiben netzabhängig.

**Touch-Zuweisung**

- Karten lassen sich am Handy mit dem Finger auf die Aktionszonen ziehen.
  Umsetzung über Pointer Events mit eigenem Hit-Testing statt der Drag-API.
- Der bestehende Tap-Weg (Karte antippen → Aktion antippen) bleibt unverändert
  erhalten und bleibt der barrierefreie Pfad.
- Die Hinweistexte stimmen wieder: heute versteckt ein Breiten-Breakpoint den
  Zieh-Hinweis unterhalb von 640 px, weil Ziehen dort nicht ging. Sobald es
  überall geht, beschreibt der Hinweis beide Wege — unabhängig von der Breite.

**Nicht in diesem Change** (bewusst ausgeklammert): Konten und Cloud-Sync
(FEATURES.md 5.x), Datenexport/-import (7.5), Ergebnis-Sharecard (6.3),
native App und Store-Themen, Passwortschutz.

## Capabilities

### New Capabilities

- `public-deployment`: Die App ist unter einer stabilen HTTPS-URL erreichbar,
  der TMDB-Schlüssel bleibt serverseitig, und Suchmaschinen indizieren sie nicht.
- `installable-app`: Die App lässt sich auf dem Homescreen installieren, startet
  eigenständig ohne Browser-Chrome und ist ohne Netzverbindung spielbar.
- `touch-card-assignment`: Ein Urteil lässt sich am Touchgerät durch Ziehen der
  Karte auf eine Aktionszone vergeben, gleichwertig zum Antippen.

### Modified Capabilities

<!-- Keine — es existieren noch keine Specs unter openspec/specs/. -->

## Impact

**Neu**

- `public/manifest.webmanifest`, App-Icons unter `public/`
- `public/sw.js` und eine Registrierungs-Komponente
- `src/app/robots.ts`
- `src/lib/game/dragAssignment.ts` (Pointer-Drag samt Hit-Testing)
- Deploy-Dokumentation

**Geändert**

- `src/app/layout.tsx` — Manifest-Verweis, `appleWebApp`-Metadaten, SW-Registrierung
- `src/components/game/RoundCard.tsx`, `src/components/game/ActionZone.tsx`,
  `src/app/play/page.tsx` — Drag-API raus, Pointer Events rein
- `src/app/globals.css` — ggf. `touch-action` für die Karten
- `next.config.mjs` — Header für `noindex` bzw. Service-Worker-Scope
- `.env.local.example` — Hinweis auf die Hosting-Variable

**Abhängigkeiten**: keine neuen npm-Pakete. Der Service Worker wird von Hand
geschrieben, statt `next-pwa` einzuziehen.

**Externe Voraussetzungen**: Vercel-Konto und ein dort hinterlegter
`TMDB_API_KEY`. TMDB erlaubt die nicht-kommerzielle Nutzung mit Attribution —
die Attribution ist vorhanden, das offizielle Logo-Asset fehlt noch
(FEATURES.md, Nachtrag Phase 4, Punkt 5).
