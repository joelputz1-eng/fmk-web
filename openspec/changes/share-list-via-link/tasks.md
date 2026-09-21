## 1. Format und Kodierung

- [x] 1.1 `src/lib/share/listPayload.ts` anlegen: Typen des Formats (`v`, `n`, `c`, `e`), Obergrenzen als benannte Konstanten (Linklänge, entpackte Bytes, Einträge, Feldlängen). Ohne IndexedDB, ohne React. Prüfen: `npx tsc --noEmit` läuft durch, die Datei importiert nichts aus `@/lib/db`.
- [x] 1.2 `encodeListPayload()` — JSON, `CompressionStream('deflate-raw')`, base64url. Prüfen: Ergebnis enthält nur `A–Z a–z 0–9 - _`, ist also ohne Escaping in ein Fragment setzbar.
- [x] 1.3 `decodeListPayload()` — base64url zurück, stückweise entpacken mit laufender Byte-Summe und hartem Abbruch an der Grenze. Prüfen: ein künstlich aufgeblähter Datenstrom bricht an der Grenze ab, statt den Speicher vollzuschreiben.
- [x] 1.4 Validierung der entpackten Struktur: Versionsnummer, Typen jedes Feldes, Zahl der Einträge, Feldlängen, Kategorieverweise im gültigen Bereich. Rückgabe als Ergebnistyp mit benanntem Fehlergrund, nicht als Ausnahme. Prüfen: jeder Fehlergrund ist von außen unterscheidbar.
- [x] 1.5 **`tests/listPayload.test.ts`** mit Fixtures, kein Netz, keine DB — analog `tests/safety.test.ts`. Muss abdecken: Rundlauf kodieren/dekodieren erhält alle Felder; abgeschnittene Eingabe wird abgelehnt; Fremdinhalt hinter `#` wird abgelehnt; unbekannte Version wird als solche gemeldet; Überlänge bei Name und Notiz greift; zu viele Einträge werden abgelehnt; Kategorieverweis außerhalb des Bereichs wird abgelehnt. Prüfen: `npm test` grün.

## 2. Liste teilen

- [x] 2.1 Lesefunktion, die eine Liste samt Einträgen und Kategoriezuordnungen in das Format überführt — soft-gelöschte Einträge bleiben draußen, Fotos ebenfalls. Prüfen: eine Liste mit Promis, eigenen Einträgen und Kategorien ergibt ein Paket, das `decodeListPayload()` unverändert zurückgibt.
- [x] 2.2 Teilen-Ansicht auf `src/app/lists/[id]/page.tsx`: Knopf „Liste teilen", darin der erzeugte Link, die Zahl der Einträge und der Hinweis, dass der Link die Namen enthält und Fotos nicht mitreisen. Prüfen: bei 360 px Breite ist der Link lesbar und nichts läuft über.
- [x] 2.3 Weitergabe über `navigator.share`, mit Kopieren in die Zwischenablage als Rückfall samt Bestätigung. Prüfen: auf einem Gerät ohne System-Teilen-Angebot landet der Link in der Zwischenablage und die Oberfläche sagt das.
- [x] 2.4 Grenzfall Länge: überschreitet der Link die Obergrenze, erscheint statt des Links ein Hinweis mit der Zahl der Einträge. Prüfen: eine künstlich große Liste erzeugt den Hinweis, eine knapp darunter einen funktionierenden Link.
- [x] 2.5 Grenzfall leere Liste: kein Link, sondern ein Hinweis. Prüfen: bei einer Liste ohne Einträge ist der Teilen-Knopf wirkungslos oder deaktiviert, mit sichtbarem Grund.

## 3. Vorschau

- [x] 3.1 `src/app/lists/import/page.tsx` anlegen: liest das Fragment, dekodiert, zeigt bei Fehlern die zum Fehlergrund passende Meldung. Prüfen: Aufruf ohne Fragment, mit Müll und mit abgeschnittenem Link ergibt je eine verständliche Meldung, kein Absturz.
- [x] 3.2 Vorschau darstellen: Listenname, Anzahl, alle Namen, dazu die Markierung „schon vorhanden" samt Zähler. Der Abgleich nutzt dieselbe Normalisierung wie `findDuplicateNames()` in `src/lib/db/entries.ts`. Prüfen: ein Name, der lokal in anderer Schreibweise existiert, gilt als vorhanden.
- [x] 3.3 Sicherstellen, dass die Vorschau nichts schreibt. Prüfen: Vorschau öffnen, Seite verlassen — in `lists`, `entries`, `categories` und `listEntries` hat sich nichts geändert.

## 4. Übernehmen

- [x] 4.1 `src/lib/db/listImport.ts`: Kategorien auflösen oder anlegen (Premade über die stabile ID, eigene über den Namen), Einträge über den normalisierten Namen zusammenführen oder neu anlegen, soft-gelöschte reaktivieren, Liste anlegen, Mitgliedschaften setzen — alles in einer Transaktion. Prüfen: zweimaliges Übernehmen desselben Links ergibt zwei Listen, aber keine doppelten Einträge und keine doppelten Kategorien.
- [x] 4.2 Ergebnis der Übernahme zurückgeben (neu angelegt, wiederverwendet, ausgelassen) und nach dem Bestätigen zur neuen Liste wechseln. Prüfen: die Zahlen in der Abschlussmeldung stimmen mit dem Datenbestand überein.
- [x] 4.3 Bestehende Listen dürfen sich nicht verändern. Prüfen: Liste mit gleichem Namen vorher anlegen, Link übernehmen — die alte Liste hat unverändert dieselben Mitglieder.

## 5. Promis nachladen

- [x] 5.1 Nach der Transaktion für jeden Eintrag mit `tmdbId` `fetchCelebrity()` rufen und das Ergebnis an `importCelebrity()` geben, gebündelt nebenläufig wie im Promi-Import. Prüfen: mit Verbindung tragen die Promi-Einträge danach ihr Bild.
- [x] 5.2 Personen, die die Alterssicherung nicht bestehen, entstehen nicht und werden gezählt. Prüfen: ein Link mit einer TMDB-Kennung, die durchfällt, erzeugt diesen Eintrag nicht und benennt die Zahl in der Abschlussmeldung.
- [x] 5.3 Ohne Verbindung entstehen die Einträge trotzdem, mit Initialen und einem Hinweis. Prüfen: Übernahme im Flugmodus liefert die vollständige Liste ohne Bilder plus Hinweis.

## 6. Abnahme

- [x] 6.1 Der Link enthält keine Nutzdaten außerhalb des Fragments. Prüfen: Netzwerk-Tab beim Öffnen eines Teilen-Links zeigt keine Anfrage, die einen der geteilten Namen enthält.
- [x] 6.2 Durchlauf zwischen zwei getrennten Browserprofilen: Liste mit eigenen Einträgen, Promis und Kategorien teilen, Link übertragen, übernehmen, Runde daraus spielen. Prüfen: Namen, Geschlechter, Notizen und Kategorien kommen an, die Liste ist spielbar.
- [x] 6.3 `npm run build` und `npm test` laufen fehlerfrei durch, und bei 360 px Breite scrollt auf Teilen- und Importansicht nichts horizontal. Prüfen: beide Kommandos grün, `scrollWidth === clientWidth`.
