## 1. Touch-Zuweisung

- [x] 1.1 `src/lib/game/dragAssignment.ts` anlegen: Zustandsmaschine für die Geste (Start, Schwelle ~8 px, Bewegung, Treffer, Abbruch) inklusive Hit-Testing über `document.elementFromPoint` und `data-verdict-zone`. Prüfen: `npx tsc --noEmit` läuft durch und die Modulgrenzen sind eingehalten (keine React-Imports in der Zustandslogik).
- [x] 1.2 `ActionZone.tsx`: HTML5-Handler (`onDragOver`, `onDragLeave`, `onDrop`) entfernen, `data-verdict-zone={verdict}` setzen, Hervorhebung von einem Prop statt von lokalem `dragOver`-State steuern lassen. Prüfen: Tap-Zuweisung funktioniert unverändert, Zone hebt sich hervor, wenn sie als Ziel gemeldet wird.
- [x] 1.3 `RoundCard.tsx`: `draggable` und `onDragStart` raus, Pointer-Handler rein, `touch-action: none` plus unterdrückte Textauswahl/iOS-Callout auf der Karte. Der `onSelect`-Pfad bleibt für Tap und Tastatur erhalten. Prüfen: kurze Berührung wählt die Karte, längere Bewegung startet das Ziehen.
- [x] 1.4 Ziehabbild (Avatar + Name, `position: fixed`, per `transform` bewegt) rendern, während eine Geste läuft. Prüfen: Das Kartenraster springt nicht, das Abbild folgt dem Zeiger.
- [x] 1.5 `src/app/play/page.tsx` verdrahten: Geste meldet Ziel-Verdict, ruft dieselbe `assign(verdict, entryId)` wie der Tap-Weg; Undo-Stack und Rückmeldung (Ton/Vibration) unverändert. Prüfen: Ziehen und Tappen erzeugen identischen Zustand, Undo macht beides rückgängig.
- [x] 1.6 Hinweistexte auf Karte und unter den Aktionszonen vereinheitlichen — der Breiten-Breakpoint, der das Ziehen versteckt hat, fällt weg. Prüfen: bei 360 px nennt der Hinweis beide Wege, nichts läuft über.
- [x] 1.7 Ziehen mit der Maus im Desktop-Browser gegenprüfen. Prüfen: Zuweisung per Maus-Drag funktioniert wie zuvor über die Drag-API.

## 2. Installierbarkeit

- [x] 2.1 Icon-Quelle als SVG unter `public/` einchecken (dreifarbige Leiste und Versalien wie in der App). Prüfen: Datei öffnet sich im Browser und sieht in Hell und Dunkel brauchbar aus.
- [x] 2.2 PNG-Größen 192, 512, maskable 512 und `apple-touch-icon` einmalig rendern und einchecken. Prüfen: Dateien liegen in `public/`, das maskable Icon hält den Sicherheitsbereich ein (Motiv innerhalb der inneren 80 %).
- [x] 2.3 `public/manifest.webmanifest` schreiben: Name, Kurzname, `start_url`, `display: standalone`, Hintergrund- und Themenfarbe passend zu den Tokens aus `globals.css`, Icon-Einträge. Prüfen: DevTools → Anwendung → Manifest zeigt keine Fehler.
- [x] 2.4 `src/app/layout.tsx`: Manifest verlinken, `appleWebApp`-Metadaten und `apple-touch-icon` ergänzen. Prüfen: In Safari erscheint beim Hinzufügen zum Home-Bildschirm das Icon mit dem Kurznamen, nicht ein Seiten-Screenshot.

## 3. Offline-Fähigkeit

- [x] 3.1 `public/sw.js` schreiben: versionierter Cache-Name, `install` legt die App-Hülle an, `activate` räumt fremde Caches ab, kein `skipWaiting`. Prüfen: Worker registriert sich, DevTools zeigt ihn als aktiv.
- [x] 3.2 `fetch`-Strategie umsetzen — Navigationen netzbevorzugt mit Cache-Fallback, `/_next/static/*` und Icons cache-first, `/api/tmdb/*` nie cachen. Prüfen: Netzwerk-Tab zeigt für TMDB-Aufrufe keine Cache-Treffer.
- [x] 3.3 Registrierung im Client einbauen (nur in Produktion, nicht in `next dev`). Prüfen: `next dev` registriert keinen Worker, `next build && next start` registriert ihn.
- [x] 3.4 Promi-Seite ohne Netz prüfen und, falls nötig, die Fehlermeldung verständlich machen. Prüfen: Offline erscheint ein Hinweis auf die fehlende Verbindung, bereits übernommene Promis bleiben spielbar.
- [x] 3.5 Offline-Durchlauf gegen `next build && next start`: Seite laden, Netz trennen, neu laden, Runde spielen. Prüfen: App startet, eigene Einträge sind da, die Runde landet im Verlauf.
- [x] 3.6 Aktualisierungspfad prüfen: Build ändern, neu deployen bzw. neu starten, App zweimal öffnen. Prüfen: die neue Fassung ist spätestens beim zweiten Start aktiv und die lokalen Daten sind unverändert.

## 4. Sichtbarkeit und Konfiguration

- [x] 4.1 `src/app/robots.ts` anlegen, die alle Crawler für die ganze Seite ausschließt. Prüfen: `/robots.txt` liefert das erwartete Regelwerk.
- [x] 4.2 `metadata.robots` im Root-Layout auf `noindex, nofollow` setzen. Prüfen: Quelltext einer beliebigen Seite enthält die Angabe.
- [x] 4.3 `.env.local.example` und eine kurze Deploy-Anleitung (README oder `DEPLOY.md`) ergänzen: benötigte Variablen, Deploy-Schritte, Rollback und der Notausgang „Service Worker deregistrieren, Site-Daten behalten". Prüfen: Jemand anderes könnte allein danach deployen.

## 5. Deployment

- [ ] 5.1 *(braucht deinen Account)* Vercel-Projekt mit dem Repository verbinden. Prüfen: Ein Push erzeugt ein Preview-Deployment.
- [ ] 5.2 *(braucht deinen Account)* `TMDB_API_KEY` in den Vercel-Projekteinstellungen hinterlegen. Prüfen: Die Promi-Suche liefert im Preview Ergebnisse.
- [ ] 5.3 Preview-Deployment abnehmen: HTTPS und HTTP-Weiterleitung, `/robots.txt`, Promi-Suche, Installation am Handy. Prüfen: alle vier Punkte bestätigt.
- [ ] 5.4 Nach dem Schlüsselwert in den ausgelieferten Bundles suchen. Prüfen: kein Treffer im HTML und in keinem JavaScript-Bundle.
- [ ] 5.5 Auf Produktion befördern und die Adresse notieren. Prüfen: Die Produktionsadresse zeigt dieselbe Fassung wie das abgenommene Preview.

## 6. Abnahme am Gerät

- [ ] 6.1 Am echten Telefon installieren und vom Homescreen starten. Prüfen: kein Browser-Chrome, Systemleistenfarbe passt zum Modus, untere Navigation sitzt über dem Home-Indikator.
- [ ] 6.2 Im Flugmodus starten und eine Runde mit eigenen Einträgen spielen. Prüfen: Runde landet im Verlauf.
- [ ] 6.3 Ziehgeste am Telefon durchspielen: freie Zone, belegte Zone, bereits zugewiesene Karte, Loslassen im Nichts, unterbrochene Geste. Prüfen: Verhalten entspricht `specs/touch-card-assignment/spec.md`.
- [x] 6.4 `npm run build` und `npm test` laufen fehlerfrei durch, und bei 360 px Breite scrollt nichts horizontal. Prüfen: beide Kommandos grün, `scrollWidth === clientWidth` auf Spiel- und Verlaufsseite.
