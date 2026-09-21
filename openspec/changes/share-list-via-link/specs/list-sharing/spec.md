## Purpose

Eine vorhandene Liste lässt sich als Link ausgeben, der sie vollständig
transportiert — ohne Konto, ohne Server und ohne dass die enthaltenen Namen
unterwegs bei einem Dritten landen.

## ADDED Requirements

### Requirement: Liste als Link ausgeben

Zu jeder Liste MUSS sich ein Link erzeugen lassen, der den Listennamen und alle
enthaltenen Einträge trägt. Je Eintrag MÜSSEN Name, Geschlecht, Notiz und
Kategoriezugehörigkeit mitreisen, bei Promis zusätzlich die TMDB-Kennung.
Fotos werden NICHT übertragen.

#### Scenario: Link zu einer Liste erzeugen

- **WHEN** auf der Detailseite einer Liste mit mehreren Einträgen „Teilen"
  gewählt wird
- **THEN** entsteht ein vollständiger Link auf die eigene Adresse, der ohne
  weitere Schritte verschickt werden kann

#### Scenario: Leere Liste

- **WHEN** eine Liste ohne Einträge geteilt werden soll
- **THEN** entsteht kein Link, sondern ein Hinweis, dass es nichts zu teilen gibt

#### Scenario: Gelöschte Einträge

- **WHEN** eine Liste Einträge enthält, die der Absender soft-gelöscht hat
- **THEN** reisen diese nicht mit — geteilt wird, was der Absender aktuell sieht

### Requirement: Nutzdaten bleiben im Fragment

Die Listendaten MÜSSEN im Fragment der URL stehen, also hinter `#`. Sie DÜRFEN
NICHT im Pfad oder in Abfrageparametern stehen, weil beides an den Server
übertragen und dort protokolliert würde.

#### Scenario: Aufbau des Links

- **WHEN** ein Teilen-Link erzeugt wurde
- **THEN** stehen Pfad und Abfrageteil frei von Listendaten, und der gesamte
  Inhalt hängt hinter dem `#`

#### Scenario: Server sieht die Namen nicht

- **WHEN** der Empfänger den Link öffnet
- **THEN** enthält die Anfrage an den Server keinen der geteilten Namen

### Requirement: Grenzen werden vorher benannt

Überschreitet der erzeugte Link eine Länge, ab der Messenger und Browser ihn
nicht mehr verlässlich weitergeben, MUSS die App das vor dem Teilen sagen und
DARF NICHT stillschweigend einen Link ausgeben, der unterwegs abgeschnitten wird.

#### Scenario: Liste zu groß

- **WHEN** eine Liste so viele Einträge hat, dass der Link die Grenze reißt
- **THEN** erscheint ein Hinweis mit der Zahl der Einträge und dem Rat, die Liste
  zu teilen, statt eines unbrauchbaren Links

#### Scenario: Liste knapp unterhalb der Grenze

- **WHEN** eine große, aber noch zulässige Liste geteilt wird
- **THEN** entsteht ein funktionierender Link

### Requirement: Weitergabe über das System

Der Link MUSS sich über das Teilen-Angebot des Geräts verschicken lassen. Wo das
nicht zur Verfügung steht, MUSS das Kopieren in die Zwischenablage funktionieren
und bestätigt werden.

#### Scenario: Teilen auf dem Telefon

- **WHEN** auf einem Gerät mit System-Teilen-Angebot „Teilen" gewählt wird
- **THEN** öffnet sich die Auswahl der Zielanwendungen mit dem Link

#### Scenario: Teilen am Schreibtisch

- **WHEN** das Gerät kein System-Teilen-Angebot hat
- **THEN** landet der Link in der Zwischenablage, und die Oberfläche bestätigt das

#### Scenario: Hinweis auf die Tragweite

- **WHEN** die Teilen-Ansicht geöffnet ist
- **THEN** steht dort, dass der Link die Namen enthält und jeder, der ihn
  bekommt, die Liste übernehmen kann
