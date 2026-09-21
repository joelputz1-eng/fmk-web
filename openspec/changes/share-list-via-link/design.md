## Context

Siehe `proposal.md` — Why. Was die Umsetzung einengt:

- Es gibt keinen Server-State. Die App hat zwar Routen unter
  `src/app/api/tmdb/**`, aber nur als Proxy zu TMDB — nichts, was etwas
  speichern könnte. Ein Share-Code, den ein Backend auflöst, ist damit keine
  Option, ohne die Architektur umzubauen.
- Das Datenmodell ist bekannt: `ListRecord`, `listEntries` als Verknüpfung,
  `EntryRecord` mit `name`, `gender`, `note`, `isCelebrity`, `tmdbId`,
  `photoBlobId`, `deletedAt`. Kategorien hängen über `entryCategories`.
  Premade-Kategorien tragen stabile IDs (`premade-actors` …), eigene eine
  zufällige.
- Vorhandene Bausteine, die genau das tun, was hier gebraucht wird:
  `importCelebrity()` in `src/lib/db/celebrities.ts` (dedupliziert über
  `tmdbId`, lädt das Bild über dieselbe Foto-Pipeline, nimmt Soft-Deletes
  zurück), `fetchCelebrity()` in `src/lib/celebrities/api.ts` (liefert die
  Bild-URL und schickt die Person durch `enrichAndFilter`), und
  `findDuplicateNames()` in `src/lib/db/entries.ts` mit der Normalisierung
  `trim().toLocaleLowerCase('de')`.
- Vier Laufzeit-Abhängigkeiten, das soll so bleiben.

## Goals / Non-Goals

**Goals:**

- Teilen, das ohne jede Infrastruktur funktioniert und offline erzeugt werden kann.
- Die geteilten Namen erreichen keinen Server.
- Ein Import, der die gepflegten Daten des Empfängers nicht beschädigt.
- Die Alterssicherung bleibt auch über den Umweg Link wirksam.

**Non-Goals:**

- Kein Rückkanal: eine geteilte Liste bleibt eine Momentaufnahme.
- Keine Fotoübertragung eigener Einträge.
- Keine Teilbarkeit von Runden, Statistiken oder Einstellungen.
- Kein Kürzungsdienst für lange Links.

## Decisions

### Nutzdaten im Fragment statt im Query-Teil

Das Fragment hinter `#` wird vom Browser nicht an den Server geschickt. Bei einer
Liste mit Namen echter Personen ist das der entscheidende Unterschied: weder das
eigene Deployment noch Vercel bekommen die Namen je zu sehen, und sie stehen in
keinem Zugriffslog.

*Alternative:* `?data=…` — technisch gleichwertig, aber jeder Aufruf schriebe die
komplette Freundesliste in die Logs der Hosting-Plattform. Für eine App, deren
Verkaufsargument „lokal und ohne Server" ist, das falsche Signal.

*Alternative:* Kurzcode mit Server-Auflösung — braucht Datenbank, Löschkonzept
und Missbrauchsschutz. Gehört zum Sync-Kapitel, nicht hierher.

### Kompression mit `CompressionStream('deflate-raw')`

Steht in allen Zielbrowsern zur Verfügung und spart bei Namenslisten grob die
Hälfte. Kodiert wird anschließend base64url, damit unterwegs nichts escaped
werden muss.

Größenordnung: 30 Einträge mit Namen, Geschlecht und Kategorien liegen roh bei
etwa 900 Bytes, komprimiert bei etwa 450, als base64url bei etwa 600 Zeichen.
Mit Adresse und Pfad bleibt der Link deutlich unter tausend Zeichen.

*Alternative:* unkomprimiertes JSON — funktioniert, wird aber ab zwanzig
Einträgen unangenehm lang, und lange Links werden in Messengern gern umgebrochen.

*Alternative:* `lz-string` — eine Abhängigkeit für etwas, das die Plattform
mitbringt.

### Obergrenzen an drei Stellen

Der Inhalt eines Links ist fremde Eingabe. Deshalb:

| Grenze | Wert | Warum |
|---|---|---|
| Linklänge beim Erzeugen | ~2000 Zeichen | Darüber kürzen Messenger und Vorschaudienste gern mit |
| Entpackte Bytes beim Lesen | 256 KB, hart abgebrochen | `DecompressionStream` kann aus wenigen Bytes sehr viel machen |
| Einträge je Liste | 500 | Eine Vorschau mit 100 000 Zeilen ist kein Dialog mehr |
| Länge je Textfeld | Name 120, Notiz 500 | Entspricht dem, was die Oberfläche ohnehin verarbeitet |

Entpackt wird stückweise mit laufender Summe, nicht erst vollständig und dann
gemessen — sonst wäre die Grenze wirkungslos.

### Format mit Versionsnummer, kurze Feldnamen

```
{ "v": 1,
  "n": "<Listenname>",
  "c": [{ "n": "<Kategorie>", "f": "<Farbe>", "p": "<premade-id>" }],
  "e": [{ "n": "<Name>", "g": "f", "o": "<Notiz>", "t": 12345, "c": [0, 2] }] }
```

Kurze Schlüssel, weil jedes Byte vor der Kompression im Link landet. Kategorien
stehen einmal im Kopf, Einträge verweisen über den Index — sonst wiederholt sich
„Schauspiel" dreißigmal. Die Versionsnummer steht vorn, damit eine spätere
Fassung einen alten Link erkennt und eine ältere App sauber ablehnen kann, statt
zu raten.

Format und Validierung liegen in `src/lib/share/listPayload.ts`, ohne
IndexedDB-Zugriff und ohne React — dieselbe Trennung wie bei
`src/lib/tmdb/safety.ts` und `src/lib/stats/leaderboard.ts`, und aus demselben
Grund: die Regeln, die falsch werden können, müssen mit Fixtures prüfbar sein.

### Zusammenführen über den normalisierten Namen

Die Normalisierung `trim().toLocaleLowerCase('de')` gibt es schon in
`findDuplicateNames()`. Sie wird hier wiederverwendet statt nachgebaut, damit
Import und Duplikatwarnung nie unterschiedlicher Meinung darüber sind, was
derselbe Mensch ist.

Bewusst bleibt es bei exaktem Vergleich nach Normalisierung: keine
Ähnlichkeitssuche. „Anna Berg" und „Anna Bergmann" sind zwei Personen, und eine
Heuristik, die das gelegentlich anders sieht, verschmilzt still zwei Menschen zu
einem — der teuerste denkbare Fehler in dieser App.

Soft-gelöschte Einträge zählen beim Abgleich mit und werden reaktiviert. Das
entspricht dem, was `importCelebrity()` bei Promis bereits tut.

### Promis laufen durch den bestehenden Importpfad

Für jeden Eintrag mit `tmdbId` wird `fetchCelebrity()` gerufen und das Ergebnis
an `importCelebrity()` gegeben. Damit ist ohne Zusatzaufwand sichergestellt, dass
die Alterssicherung erneut greift: `/api/tmdb/person/{id}` schickt jede Person
durch `enrichAndFilter`, und ein Link kann daran nicht vorbei.

Die Abfragen laufen gebündelt nebenläufig, wie beim Promi-Import auch. Schlägt
eine fehl, entsteht der Eintrag weiterhin ohne Bild — außer die Person fällt
durch die Alterssicherung, dann entsteht sie gar nicht und wird in der
Abschlussmeldung gezählt.

### Import als eine Transaktion, Bilder danach

Liste, Einträge, Kategorien und Zuordnungen entstehen in einer
IndexedDB-Transaktion. Die Bilder kommen anschließend, weil sie Netz brauchen und
eine IndexedDB-Transaktion kein `await` auf `fetch` überlebt. Konsequenz: die
Liste ist sofort vollständig und spielbar, die Gesichter trudeln nach.

## Risks / Trade-offs

- **Wer den Link hat, hat die Namen.** Es gibt keinen Widerruf, kein Ablaufdatum
  und keine Sperre. → Die Teilen-Ansicht sagt das ausdrücklich, statt es zu
  verschweigen. Mehr kann eine App ohne Server nicht leisten, und ein
  Ablaufdatum vorzutäuschen wäre schlimmer als keins.
- **Fotos fehlen bei eigenen Einträgen.** Wer eine Liste mit Gesichtern gepflegt
  hat, teilt sie ohne. → Beim Teilen benennen. Wenn das drückt, ist die
  Dateiübergabe (FEATURES.md 7.5) der richtige nächste Schritt, nicht ein
  längerer Link.
- **Namensgleiche Personen werden zusammengeführt.** Zwei verschiedene „Anna
  Berg" im Bekanntenkreis landen auf einem Eintrag. → Die Vorschau zeigt vorher,
  welche Namen als vorhanden gelten; danach lässt sich der Eintrag umbenennen und
  trennen. Die Gegenrichtung — alles doppelt anlegen — erzeugt in jeder anderen
  Lage Unordnung.
- **Ein manipulierter Link ist ein fremder Codepfad.** → Strenge Validierung,
  harte Obergrenzen, Versionsprüfung; alles in reinen Funktionen mit Tests. Die
  Namen selbst werden von React escaped und nie als Markup eingesetzt.
- **Die Vorschau lässt nichts abwählen.** Wer nur die Hälfte will, muss hinterher
  aufräumen. → Bewusst so gewählt; der Aufwand liegt damit beim Ausnahmefall,
  nicht bei jedem Import.

## Migration Plan

Keine Schemaänderung. Der Import schreibt in bestehende Stores, die
Datenbankversion bleibt bei 2.

1. `listPayload.ts` mit Tests — Format, Kodierung, Grenzen, Ablehnungen.
2. Teilen-Ansicht auf der Listendetailseite, gegen den Dekoder gegengeprüft.
3. Importseite mit Vorschau, zunächst ohne Schreibpfad.
4. Schreibpfad, inklusive Zusammenführung und Kategorien.
5. Promi-Nachladen.
6. Abnahme zwischen zwei Browsern: teilen, Link übertragen, übernehmen.

**Rollback:** rein additiv. Fällt die Funktion weg, bleiben bereits übernommene
Listen normale lokale Listen — sie tragen keine Spur ihrer Herkunft.

## Open Questions

- Soll eine übernommene Liste erkennbar bleiben („übernommen am …")? Ohne
  Herkunftsvermerk ist sie von einer selbst angelegten nicht zu unterscheiden.
  Beides erfüllt die Spec; die Entscheidung ändert weder Format noch
  Aufgabenschnitt und lässt sich nachholen.
