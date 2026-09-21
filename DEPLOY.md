# Deployment

Die App ist eine Next-Anwendung mit serverseitigen Routen unter
`src/app/api/tmdb/**`. Ein statischer Export geht deshalb nicht — der
TMDB-Schlüssel müsste dafür in den Browser wandern, und genau das soll er nie.

Gehostet wird auf **Vercel**. Alle Spieldaten liegen in IndexedDB im Browser der
Nutzenden; es gibt keine Datenbank, keinen Server-State und folglich auch keine
Migration beim Deployen.

## Einmalig einrichten

1. Auf [vercel.com](https://vercel.com) ein Projekt anlegen und dieses
   Repository verbinden. Framework-Erkennung („Next.js") passt, das
   Build-Kommando bleibt `npm run build`.
2. Unter **Settings → Environment Variables** eintragen:

   | Name | Wert | Umgebungen |
   |---|---|---|
   | `TMDB_API_KEY` | der v3-API-Key von themoviedb.org | Production, Preview |

   Kein `NEXT_PUBLIC_`-Präfix. Der Schlüssel wird ausschließlich serverseitig
   gelesen; wie man ihn bekommt, steht in `.env.local.example`.

Mehr braucht es nicht. Ohne den Schlüssel läuft die App, nur die Promi-Funktionen
melden einen Fehler — alles andere funktioniert.

## Deployen

Ein Push auf einen Branch erzeugt ein Preview-Deployment, ein Push auf `main`
geht nach Produktion.

`npm run build` zieht über den `postbuild`-Hook automatisch
`scripts/build-sw.mjs` nach. Das Skript erzeugt `public/sw.js` aus
`scripts/sw.template.js` und trägt die Build-ID sowie die echte Liste der
Next-Assets ein. **Die Datei liegt bewusst nicht im Repository** — sie muss zu
genau diesem Build passen, sonst zeigt eine offline geöffnete Seite eine weiße
Fläche statt der App.

Folglich: Wer das Build-Kommando ändert, muss den `postbuild`-Hook mitnehmen.

## Nach dem Deployen prüfen

- `https://<adresse>/robots.txt` → `Disallow: /`. Die App ist öffentlich
  erreichbar, soll aber nicht in Suchmaschinen landen. Das ist Verschleierung,
  kein Zugangsschutz: wer die Adresse hat, kann spielen.
- Promi-Suche liefert Treffer → der Schlüssel ist angekommen.
- Am Handy aufrufen und installieren → Icon mit dem Kurznamen „FMK", App startet
  ohne Adressleiste.
- Flugmodus, App starten → eigene Einträge sind da, eine Runde ist spielbar.

## Rollback

In Vercel unter **Deployments** das vorherige Deployment auswählen und
*Promote to Production*.

**Wichtig:** Ein Rollback ersetzt den Server, nicht den Service Worker, der auf
den Geräten schon installiert ist. Der ist bewusst simpel gehalten — Navigationen
holen immer zuerst das Netz, eine kaputte Cache-Antwort kann also nicht dauerhaft
gewinnen. Falls trotzdem etwas klemmt:

1. In den Browser-Einstellungen der Seite den Service Worker deregistrieren
   (Chrome: DevTools → Application → Service Workers → *Unregister*; am Handy:
   Website-Einstellungen).
2. **Site-Daten dabei nicht löschen.** Darin stecken alle Einträge, Listen und
   Runden — es gibt noch keinen Export, das wäre unwiederbringlich weg.

## Bekannte Grenzen

- **Kein Backup.** Browserdaten löschen, Privatmodus oder ein neues Gerät heißt:
  alles weg. Datenexport ist der logische nächste Schritt (FEATURES.md 7.5).
- **Geteiltes TMDB-Kontingent.** Wer die Adresse hat, verbraucht den Schlüssel.
  Die Alterssicherung kostet pro Suche N+1 Requests. Für den Freundeskreis
  unkritisch; wandert der Link, ist ein Zugangsschutz oder ein persistenter
  Cache der nächste Schritt.
- **TMDB-Logo** ist derzeit ein Textlink in den Markenfarben. Vor einer breiteren
  Verteilung gehört das offizielle Asset aus dem Branding-Kit dorthin.
  Kommerzielle Nutzung bleibt bei TMDB genehmigungspflichtig.
