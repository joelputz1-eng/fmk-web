## Context

Siehe `proposal.md` — Why. Was die Umsetzung einengt:

- Die App hat serverseitige Routen (`src/app/api/tmdb/**`), die den TMDB-Key
  lesen. Ein statischer Export scheidet damit aus; es braucht einen Host, der
  Node-Funktionen ausführt.
- Alle Spieldaten liegen in IndexedDB. Es gibt keinen Server-State, den ein
  Deployment migrieren müsste — dafür auch kein Backup: wer Browserdaten löscht,
  verliert alles. Export/Import ist bewusst nicht Teil dieser Runde.
- Das Projekt hat bisher vier Laufzeit-Abhängigkeiten (`idb`, `next`, `react`,
  `react-dom`). Diese Sparsamkeit soll bleiben.
- Karten sind `<button>`-Elemente mit `draggable` und HTML5-Drag-Handlern
  (`RoundCard.tsx`, `ActionZone.tsx`). Die Zuweisungslogik liegt bereits
  zentral in `assign()` in `src/app/play/page.tsx` — Tap und Drop rufen
  dieselbe Funktion. Das bleibt so; nur der Weg dorthin ändert sich.

## Goals / Non-Goals

**Goals:**

- Ein Deploy-Weg, der ohne Handarbeit wiederholbar ist.
- Offline-Fähigkeit, die dem Datenmodell entspricht: die App-Hülle und das
  eigene Material funktionieren ohne Netz, TMDB nicht.
- Eine Ziehgeste, die sich auf dem Telefon richtig anfühlt, ohne den Tap-Weg
  oder die Tastaturbedienung zu beschädigen.
- Keine neuen npm-Abhängigkeiten.

**Non-Goals:**

- Kein Offline-Browsen der Promi-Packs (der `tmdbCache`-Store bleibt ungenutzt).
- Keine Push-Benachrichtigungen, kein Background-Sync.
- Keine Drag-Geste außerhalb des Spielbildschirms.
- Keine Umstellung der bestehenden Zuweisungs- oder Undo-Logik.

## Decisions

### Hosting: Vercel

Die App braucht eine Node-Laufzeit für die TMDB-Routen und Next-eigenes Caching
(`revalidate: 86400` in den Packs). Vercel führt das ohne Konfiguration aus,
liefert HTTPS samt Weiterleitung und erlaubt Rollback auf ein früheres
Deployment per Klick.

*Alternativen:* Statischer Export auf beliebigem Webspace — scheitert an den
API-Routen, der Key müsste in den Client. Eigener Server oder Container — mehr
Kontrolle, aber Zertifikate und Updates von Hand, für eine Freundeskreis-App
unverhältnismäßig.

### Service Worker von Hand statt `next-pwa`

Der Bedarf ist klein: App-Hülle cachen, Navigationen netzbevorzugt bedienen,
`/api/tmdb/*` nie cachen. Das sind ungefähr sechzig Zeilen. `next-pwa` zieht
Workbox mit und ist auf den App Router hin schlecht gepflegt.

Caching-Strategie:

| Anfrage | Strategie | Begründung |
|---|---|---|
| Navigationen (HTML) | network-first, Fallback Cache | Sonst klebt eine alte Seite fest |
| `/_next/static/*` | cache-first | Inhaltsgehashte Namen, unveränderlich |
| Icons, Manifest | cache-first | Ändern sich praktisch nie |
| `/api/tmdb/*` | nie cachen | Alterssicherung und Packs sollen frisch sein |

*Alternative:* Serwist (Workbox-Nachfolger für Next) — sauberer als `next-pwa`,
aber eine Abhängigkeit für Verhalten, das wir vollständig selbst beschreiben
können.

### Kein `skipWaiting` — neue Version greift beim nächsten Start

Ein neuer Service Worker wartet, bis alle Tabs geschlossen sind, und übernimmt
dann. Das erfüllt „spätestens beim nächsten Start" aus der Spec, ohne dass
mitten in einer laufenden Runde die Assets unter der Seite ausgetauscht werden.
Der Cache-Name trägt eine Version; beim `activate` fliegen fremde Caches raus.

*Alternative:* `skipWaiting` plus erzwungener Reload — schneller, kann aber eine
unfertige Runde wegreißen. Für eine App, die man zu dritt am Tisch benutzt, der
schlechtere Handel.

### `noindex` über Next-Bordmittel

`src/app/robots.ts` erzeugt die `robots.txt`, `metadata.robots` im Root-Layout
setzt die Meta-Angabe auf jeder Seite. Beides sind erste-Klasse-APIs von Next,
kein Middleware-Umweg.

Wichtig: Das ist Verschleierung, kein Schutz. Wer die URL hat, kommt rein — so
gewollt (siehe `proposal.md`).

### Ziehen über Pointer Events mit eigenem Hit-Testing

Die HTML5-Drag-API feuert auf Touch nicht und lässt sich nicht nachrüsten.
Pointer Events decken Finger, Maus und Stift mit einem Codepfad ab.

Ablauf:

1. `pointerdown` auf der Karte merkt sich Startpunkt und Zeiger-ID,
   `setPointerCapture` hält die Ereignisse bei der Karte, auch wenn der Finger
   sie verlässt.
2. Erst ab einer Schwelle von etwa 8 px gilt die Geste als Ziehen. Darunter
   bleibt es ein Tap und der bestehende `onSelect`-Pfad greift — damit trennt
   sich Wählen sauber von Ziehen.
3. Während des Ziehens folgt ein leichtgewichtiges Abbild (Avatar und Name,
   `position: fixed`, per `transform` bewegt) dem Zeiger. Die echte Karte bleibt
   an ihrem Platz, damit das Raster nicht springt.
4. Die Zone unter dem Zeiger wird über `document.elementFromPoint` ermittelt und
   per `data-verdict-zone`-Attribut identifiziert — das koppelt die Karte nicht
   an Refs fremder Komponenten.
5. `pointerup` über einer Zone ruft dieselbe `assign(verdict, entryId)` wie der
   Tap-Weg. `pointercancel` und Loslassen im Nichts verwerfen die Geste.

Damit die Geste am Telefon nicht mit dem Scrollen kämpft, bekommen die Karten
`touch-action: none` sowie unterdrückte Textauswahl und unterdrücktes
iOS-Callout. Das ist vertretbar, weil die Karte selbst keine scrollbare Fläche
ist.

Die Mechanik liegt in `src/lib/game/dragAssignment.ts`, damit `RoundCard`
weiterhin überwiegend Darstellung ist und die Geste ohne Spielseite prüfbar
bleibt.

*Alternativen:* `dnd-kit` oder `react-dnd` — beide lösen ein viel größeres
Problem (Sortieren, Listen, Sensoren) und wären die erste UI-Abhängigkeit im
Projekt. Drag-API für Maus plus Pointer für Touch — zwei Pfade für dieselbe
Geste, doppelte Fehlerquelle.

### Icons aus der vorhandenen Bildsprache, ohne Build-Abhängigkeit

Quelle ist eine eingecheckte SVG-Datei (dreifarbige Leiste und Versalien wie in
der App). Die PNG-Größen 192, 512 und maskable 512 sowie das `apple-touch-icon`
werden einmalig gerendert und als Datei eingecheckt — kein Bildwerkzeug in
`devDependencies`, weil sich die Icons praktisch nie ändern.

## Risks / Trade-offs

- **Ein kaputter Service Worker überlebt das Rollback.** Ein Vercel-Rollback
  ersetzt den Server, nicht den bereits installierten Worker auf dem Gerät.
  → Der Worker bleibt bewusst simpel, Navigationen sind netzbevorzugt (eine
  kaputte Cache-Antwort kann also nicht dauerhaft gewinnen), und die Deploy-Doku
  beschreibt den Notausgang: Worker deregistrieren und Site-Daten der App
  dabei behalten.
- **Öffentliche URL heißt geteiltes TMDB-Kontingent.** Wer den Link hat,
  verbraucht den Schlüssel, und die Alterssicherung kostet N+1 Requests pro
  Suche. → Für den Freundeskreis unkritisch; wandert der Link doch, ist der
  nächste Schritt ein Zugangsschutz oder ein persistenter Cache. Bewusst nicht
  jetzt.
- **Kein Backup.** Site-Daten löschen, Privatmodus oder ein neues Gerät heißt:
  alles weg. → Bekannt und akzeptiert; Export/Import (FEATURES.md 7.5) ist der
  logische nächste Change und sollte nicht lange warten.
- **`touch-action: none` auf den Karten kann Scrollen behindern,** falls das
  Kartenraster je höher wird als der Bildschirm. → Nur die Karten selbst
  bekommen die Eigenschaft, nicht ihr Container; am Telefon stehen die drei
  Karten ohnehin nebeneinander.
- **Offline-Verhalten lässt sich nur am Gerät wirklich prüfen.** Der
  Offline-Schalter der DevTools ist eine Näherung. → Abnahme am echten Telefon
  im Flugmodus, nicht nur im Desktop-Browser.
- **TMDB-Logo fehlt noch als offizielles Asset** (FEATURES.md, Nachtrag Phase 4,
  Punkt 5). → Gehört vor eine breitere Verteilung, blockiert aber kein
  Deployment im Freundeskreis.

## Migration Plan

Es gibt keine Datenmigration — die Datenbank bleibt auf Version 2, und lokale
Daten werden von diesem Change nicht angefasst.

1. Icons und Manifest einchecken, lokal im Anwendungs-Tab der DevTools prüfen.
2. Service Worker einbauen und gegen `next build && next start` testen, nicht
   gegen `next dev` — dort verhält sich Caching anders.
3. Vercel-Projekt anlegen, `TMDB_API_KEY` als Environment-Variable setzen,
   Preview-Deployment prüfen: Promi-Suche, `robots.txt`, Installation am Handy.
4. Auf Produktion befördern.
5. Touch-Drag am echten Telefon abnehmen: beide Wege, Tastatur, 360 px.

**Rollback:** Vercel auf das vorherige Deployment zurücksetzen. Falls ein
Service Worker Ärger macht: in den Browser-Einstellungen der App den Worker
deregistrieren — Site-Daten dabei *nicht* löschen, sonst sind die Spieldaten
weg.

## Open Questions

- Eigene Domain oder die von Vercel vergebene `*.vercel.app`-Adresse? Beides
  erfüllt die Spec; die Entscheidung lässt sich nach dem ersten Deployment
  nachholen, ohne dass sich Aufgaben ändern.
