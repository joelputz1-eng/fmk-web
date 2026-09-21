## Purpose

Die App lässt sich auf dem Homescreen installieren, startet dort wie eine
eigenständige Anwendung und bleibt ohne Netzverbindung spielbar — passend dazu,
dass alle Spieldaten ohnehin lokal auf dem Gerät liegen.

## ADDED Requirements

### Requirement: Installierbarkeit auf dem Homescreen

Die App MUSS die Angaben bereitstellen, die ein Browser für die Installation auf
dem Homescreen benötigt: Name, Kurzname, Start-Adresse, Anzeigemodus, Hinter-
und Themenfarbe sowie Icons in den nötigen Größen, darunter ein maskierbares.

#### Scenario: Installation unter Android/Chrome

- **WHEN** die App in Chrome auf einem Android-Gerät geöffnet wird
- **THEN** bietet der Browser die Installation an, und nach der Installation
  liegt ein Icon mit dem App-Namen auf dem Homescreen

#### Scenario: Installation unter iOS/Safari

- **WHEN** in Safari „Zum Home-Bildschirm" gewählt wird
- **THEN** erscheint das App-Icon mit dem Kurznamen, nicht ein Screenshot der Seite

### Requirement: Eigenständiger Start ohne Browser-Bedienleiste

Vom Homescreen gestartet MUSS die App im eigenständigen Anzeigemodus laufen,
also ohne Adressleiste und Browser-Tabs.

#### Scenario: Start vom Homescreen

- **WHEN** die installierte App über ihr Icon gestartet wird
- **THEN** füllt sie den Bildschirm ohne Adressleiste, und die untere Navigation
  sitzt oberhalb des Home-Indikators

#### Scenario: Statusleistenfarbe

- **WHEN** die App im hellen bzw. dunklen Modus startet
- **THEN** passt die Farbe der Systemleisten zum jeweiligen Farbschema

### Requirement: Spielbar ohne Netzverbindung

Nach dem ersten Laden MUSS die App ohne Netzverbindung startbar und mit eigenen
Einträgen spielbar sein. Funktionen, die zwingend Netz brauchen, MÜSSEN das
verständlich melden, statt stillschweigend leer zu bleiben.

#### Scenario: Offline starten und spielen

- **WHEN** das Gerät im Flugmodus ist und die installierte App gestartet wird
- **THEN** lädt die App, die eigenen Einträge sind vorhanden, eine Runde lässt
  sich spielen und wird im Verlauf gespeichert

#### Scenario: Promi-Packs ohne Netz

- **WHEN** ohne Netzverbindung die Promi-Seite geöffnet wird
- **THEN** erscheint ein Hinweis, dass dafür eine Verbindung nötig ist; bereits
  übernommene Promis bleiben spielbar

### Requirement: Neue Version erreicht das Gerät

Nach einem neuen Deployment MUSS die installierte App die neue Fassung
übernehmen, ohne dass Nutzende Browserdaten löschen müssen.

#### Scenario: Aktualisierung nach Deployment

- **WHEN** eine neue Version deployt wurde und die installierte App mit
  Netzverbindung geöffnet wird
- **THEN** läuft spätestens beim nächsten Start die neue Fassung

#### Scenario: Lokale Daten überleben die Aktualisierung

- **WHEN** die App auf eine neue Fassung wechselt
- **THEN** bleiben Einträge, Listen, Runden und Einstellungen unverändert erhalten
