## Purpose

Die App ist als gehostete Web-Anwendung unter einer stabilen Adresse erreichbar,
ohne dabei den TMDB-Zugangsschlüssel preiszugeben oder in Suchmaschinen zu
landen.

## ADDED Requirements

### Requirement: Erreichbarkeit unter stabiler HTTPS-Adresse

Die App MUSS über eine feste, öffentliche HTTPS-Adresse aufrufbar sein. Ein
Aufruf über HTTP MUSS auf HTTPS umgeleitet werden.

#### Scenario: Aufruf der Produktionsadresse

- **WHEN** die Produktionsadresse im Browser geöffnet wird
- **THEN** wird die Startseite über HTTPS ausgeliefert und die Navigation zu
  Spielen, Einträgen und Verlauf funktioniert

#### Scenario: Aufruf über HTTP

- **WHEN** dieselbe Adresse über `http://` aufgerufen wird
- **THEN** leitet der Host auf die HTTPS-Variante um, bevor Inhalt ausgeliefert wird

### Requirement: TMDB-Schlüssel bleibt serverseitig

Der TMDB-Zugangsschlüssel MUSS ausschließlich serverseitig gelesen werden und
DARF NICHT im an den Browser ausgelieferten Code auftauchen.

#### Scenario: Schlüssel im Client-Bundle

- **WHEN** die ausgelieferten JavaScript-Bundles und der HTML-Quelltext
  nach dem Schlüsselwert durchsucht werden
- **THEN** findet sich der Wert an keiner Stelle

#### Scenario: Promi-Funktionen ohne konfigurierten Schlüssel

- **WHEN** die App ohne hinterlegten TMDB-Schlüssel deployt wurde und die
  Promi-Seite geöffnet wird
- **THEN** erscheint eine verständliche Fehlermeldung, und der Rest der App
  bleibt bedienbar

### Requirement: Keine Indizierung durch Suchmaschinen

Die App MUSS Suchmaschinen anweisen, sie weder zu indizieren noch ihren Links
zu folgen. Sie bleibt dabei ohne Zugangsschutz erreichbar.

#### Scenario: robots.txt

- **WHEN** `/robots.txt` abgerufen wird
- **THEN** untersagt die Antwort allen Crawlern das Indizieren der gesamten Seite

#### Scenario: Robots-Angabe auf jeder Seite

- **WHEN** eine beliebige Seite der App geladen wird
- **THEN** enthält die Antwort eine `noindex, nofollow`-Angabe

#### Scenario: Zugriff ohne Zugangsdaten

- **WHEN** eine Person die Adresse ohne jede Anmeldung aufruft
- **THEN** kann sie die App uneingeschränkt benutzen
