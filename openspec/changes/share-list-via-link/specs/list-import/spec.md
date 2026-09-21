## Purpose

Ein geteilter Link lässt sich auf einem anderen Gerät einlösen: erst ansehen,
dann bewusst übernehmen — ohne dass dabei Doppelgänger entstehen oder ein
manipulierter Link Schaden anrichtet.

## ADDED Requirements

### Requirement: Vorschau vor jeder Änderung

Ein geöffneter Teilen-Link MUSS zuerst eine Vorschau zeigen: Listenname, Anzahl
der Einträge und die Namen. Solange nicht bestätigt wurde, DARF NICHT in die
Datenbank geschrieben werden.

#### Scenario: Link geöffnet

- **WHEN** ein gültiger Teilen-Link aufgerufen wird
- **THEN** erscheint die Vorschau mit Listenname, Anzahl und allen Namen, und
  die vorhandenen Daten sind unverändert

#### Scenario: Abbrechen

- **WHEN** die Vorschau ohne Bestätigung verlassen wird
- **THEN** ist keine Liste, kein Eintrag und keine Kategorie entstanden

#### Scenario: Bekannte Namen sind erkennbar

- **WHEN** die Vorschau Namen enthält, die es beim Empfänger schon gibt
- **THEN** sind genau diese als bereits vorhanden markiert, samt ihrer Anzahl

### Requirement: Übernehmen legt eine neue Liste an

Beim Bestätigen MUSS eine neue Liste mit dem Namen aus dem Link entstehen, die
alle Einträge aus dem Link enthält. Bestehende Listen des Empfängers DÜRFEN
NICHT verändert werden.

#### Scenario: Liste kommt an

- **WHEN** die Vorschau bestätigt wird
- **THEN** existiert eine Liste mit dem Namen aus dem Link, sie enthält alle
  Einträge, und die Ansicht wechselt zu dieser Liste

#### Scenario: Namensgleiche Liste vorhanden

- **WHEN** der Empfänger bereits eine Liste dieses Namens hat
- **THEN** entsteht trotzdem eine eigene neue Liste; die vorhandene bleibt
  unangetastet

#### Scenario: Zweimal denselben Link einlösen

- **WHEN** derselbe Link ein zweites Mal übernommen wird
- **THEN** entsteht eine weitere Liste, aber keine doppelten Einträge

### Requirement: Vorhandene Einträge werden wiederverwendet

Trägt ein Eintrag aus dem Link denselben Namen wie ein vorhandener Eintrag,
MUSS der vorhandene verwendet werden, statt einen zweiten anzulegen. Foto,
Notiz und Kategorien des Empfängers MÜSSEN dabei erhalten bleiben. Der
Namensvergleich MUSS Groß- und Kleinschreibung sowie Leerraum am Rand ignorieren.

#### Scenario: Name schon vorhanden

- **WHEN** ein Eintrag „Anna Berg" übernommen wird und es diesen Eintrag mit
  Foto bereits gibt
- **THEN** wandert der vorhandene Eintrag in die neue Liste, behält sein Foto,
  und die Eintragsübersicht zeigt ihn weiterhin genau einmal

#### Scenario: Schreibweise weicht ab

- **WHEN** der Link „anna berg " enthält und lokal „Anna Berg" existiert
- **THEN** gilt das als dieselbe Person

#### Scenario: Eintrag war gelöscht

- **WHEN** ein namensgleicher Eintrag beim Empfänger soft-gelöscht ist
- **THEN** wird er wieder aktiv und ist Teil der neuen Liste, statt dass ein
  zweiter mit gleichem Namen entsteht

#### Scenario: Neue Namen

- **WHEN** der Link Namen enthält, die es beim Empfänger nicht gibt
- **THEN** entstehen dafür neue Einträge mit Geschlecht und Notiz aus dem Link

### Requirement: Promis kommen mit Bild und erneuter Alterssicherung

Einträge mit TMDB-Kennung MÜSSEN beim Übernehmen erneut über die eigene
TMDB-Schnittstelle geprüft werden. Die Alterssicherung (FEATURES.md 4.6) MUSS
dabei erneut greifen — ein Link DARF sie nicht umgehen können. Das Bild wird
dabei nachgeladen.

#### Scenario: Promi mit Bild

- **WHEN** eine Liste mit Promis bei bestehender Verbindung übernommen wird
- **THEN** tragen die Promi-Einträge danach ihr Bild

#### Scenario: Promi fällt durch die Alterssicherung

- **WHEN** der Link eine TMDB-Kennung enthält, die die Prüfung nicht besteht
- **THEN** entsteht dieser Eintrag nicht, und die Oberfläche benennt, wie viele
  Einträge aus diesem Grund fehlen

#### Scenario: Übernehmen ohne Verbindung

- **WHEN** die Liste ohne Netzverbindung übernommen wird
- **THEN** entstehen die Einträge trotzdem, tragen Initialen statt Bild, und ein
  Hinweis erklärt, dass die Bilder fehlen

### Requirement: Kategorien reisen mit

Kategorien aus dem Link MÜSSEN beim Empfänger vorhanden sein, nachdem die Liste
übernommen wurde. Bereits vorhandene Kategorien MÜSSEN wiederverwendet und
DÜRFEN NICHT dupliziert werden.

#### Scenario: Mitgelieferte Kategorie fehlt lokal

- **WHEN** eine Kategorie aus dem Link beim Empfänger nicht existiert
- **THEN** wird sie angelegt und den betreffenden Einträgen zugeordnet

#### Scenario: Kategorie existiert bereits

- **WHEN** eine Kategorie desselben Namens bereits existiert
- **THEN** wird die vorhandene verwendet, und es entsteht keine zweite

### Requirement: Kaputte und böswillige Links richten keinen Schaden an

Der Inhalt eines Links MUSS als fremde Eingabe behandelt werden. Fehlerhafte,
abgeschnittene oder unplausible Links MÜSSEN mit einer verständlichen Meldung
enden statt mit einem Absturz. Es MÜSSEN Obergrenzen für die entpackte
Datenmenge, die Zahl der Einträge und die Länge einzelner Felder gelten.

#### Scenario: Abgeschnittener Link

- **WHEN** ein unterwegs gekürzter Link geöffnet wird
- **THEN** erscheint ein Hinweis, dass der Link unvollständig ist, und nichts
  wird geschrieben

#### Scenario: Fremder Inhalt hinter dem Rautezeichen

- **WHEN** hinter `#` etwas steht, das kein Listenpaket ist
- **THEN** erscheint dieselbe verständliche Meldung, und die App bleibt bedienbar

#### Scenario: Aufgeblähter Inhalt

- **WHEN** ein Link entpackt ein Vielfaches dessen ergibt, was eine Liste je
  umfasst
- **THEN** bricht die Verarbeitung an der Obergrenze ab, ohne den Browser zum
  Stillstand zu bringen

#### Scenario: Übergroße Felder

- **WHEN** ein Eintrag im Link einen überlangen Namen oder eine überlange Notiz
  trägt
- **THEN** wird der Link abgelehnt oder das Feld auf die zulässige Länge gekürzt,
  und die Vorschau zeigt, was tatsächlich ankäme

#### Scenario: Versionsangabe passt nicht

- **WHEN** ein Link ein Format trägt, das diese Fassung der App nicht kennt
- **THEN** erscheint der Hinweis, dass die App aktualisiert werden muss
