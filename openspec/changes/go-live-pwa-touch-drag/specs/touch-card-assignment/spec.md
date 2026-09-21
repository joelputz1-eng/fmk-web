## Purpose

Ein Urteil lässt sich auf jedem Eingabegerät durch Ziehen der Karte auf eine
Aktionszone vergeben — am Touchscreen genauso wie mit der Maus — ohne dass der
bestehende Weg über zwei Taps verloren geht.

## ADDED Requirements

### Requirement: Karte per Ziehen einer Aktion zuweisen

Eine Karte MUSS sich mit Finger, Maus oder Stift auf eine Aktionszone ziehen
lassen. Beim Loslassen über einer Zone MUSS dasselbe passieren wie beim
Zuweisen per Tap: die Karte erhält dieses Urteil, eine frühere Zuweisung
derselben Karte wird aufgehoben, und die Aktion lässt sich rückgängig machen.

#### Scenario: Ziehen auf eine freie Zone am Touchscreen

- **WHEN** eine Karte mit dem Finger auf eine unbelegte Aktionszone gezogen und
  dort losgelassen wird
- **THEN** ist die Karte dieser Aktion zugewiesen, die Zone zeigt ihren Namen,
  und die übliche Rückmeldung (Ton/Vibration, sofern aktiv) erfolgt

#### Scenario: Ziehen auf eine bereits belegte Zone

- **WHEN** eine Karte auf eine Zone gezogen wird, die schon eine andere Karte enthält
- **THEN** übernimmt die gezogene Karte die Zone, und die verdrängte Karte ist
  wieder ohne Urteil

#### Scenario: Karte war bereits anderswo zugewiesen

- **WHEN** eine bereits zugewiesene Karte auf eine andere Zone gezogen wird
- **THEN** gilt nur noch das neue Urteil, die alte Zone ist wieder frei

#### Scenario: Loslassen außerhalb jeder Zone

- **WHEN** die Karte losgelassen wird, ohne dass der Finger über einer Zone steht
- **THEN** ändert sich keine Zuweisung, und die Karte sitzt wieder an ihrem Platz

#### Scenario: Ziehen abgebrochen

- **WHEN** die Geste unterbrochen wird, etwa durch einen eingehenden Anruf oder
  eine Systemgeste
- **THEN** ändert sich keine Zuweisung, und die Oberfläche bleibt bedienbar

### Requirement: Rückmeldung während des Ziehens

Während des Ziehens MUSS erkennbar sein, welche Karte bewegt wird und über
welcher Zone sie gerade liegt.

#### Scenario: Zone unter dem Finger

- **WHEN** die gezogene Karte über einer Aktionszone steht
- **THEN** hebt sich diese Zone sichtbar hervor, und verlässt der Finger sie
  wieder, verschwindet die Hervorhebung

#### Scenario: Seite scrollt nicht mit

- **WHEN** eine Karte am Touchscreen gezogen wird
- **THEN** scrollt die Seite währenddessen nicht mit, und es wird kein Text markiert

### Requirement: Zuweisen per Tap bleibt erhalten

Der bestehende Weg — Karte antippen, dann Aktion antippen — MUSS unverändert
funktionieren und bleibt der Pfad für Tastatur und Screenreader. Eine kurze
Berührung ohne Bewegung DARF NICHT als Ziehen gewertet werden.

#### Scenario: Zuweisen mit zwei Taps

- **WHEN** eine Karte angetippt und danach eine Aktionszone angetippt wird
- **THEN** ist die Karte dieser Aktion zugewiesen

#### Scenario: Kurze Berührung ohne Bewegung

- **WHEN** eine Karte berührt und ohne nennenswerte Bewegung wieder losgelassen wird
- **THEN** gilt das als Auswahl der Karte, nicht als abgebrochenes Ziehen

#### Scenario: Bedienung per Tastatur

- **WHEN** Karte und Aktionszone per Tastatur angesteuert und ausgelöst werden
- **THEN** funktioniert die Zuweisung wie per Tap, mit sichtbarem Fokus

### Requirement: Hinweistexte beschreiben die tatsächlich möglichen Wege

Die Hinweise auf der Karte und unter den Aktionszonen MÜSSEN beide Wege nennen,
sobald beide funktionieren, und DÜRFEN NICHT abhängig von der Bildschirmbreite
etwas verschweigen oder versprechen, was das Gerät nicht kann.

#### Scenario: Schmales Touchgerät

- **WHEN** die Spielseite auf einem Telefon mit 360 px Breite geöffnet wird
- **THEN** nennt der Hinweis sowohl das Antippen als auch das Ziehen, ohne dass
  das Layout überläuft
