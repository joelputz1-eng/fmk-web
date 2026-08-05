/**
 * Wikidata-Beruf (P106) → Premade-Kategorie.
 *
 * Warum ueberhaupt eine Handtabelle: TMDB kennt kein Berufsfeld.
 * `known_for_department` beschreibt die Rolle in einer *Filmproduktion* —
 * Cristiano Ronaldo steht dort auf "Acting", weil er in Dokus vorkommt. Aus
 * TMDB allein ist der Beruf nicht zu holen, aus Wikidata schon.
 *
 * Warum flach und nicht ueber die Klassenhierarchie: "Fussballspieler ist
 * Unterklasse von Sportler" waere elegant, kostet aber pro Person weitere
 * Requests. Die Tabelle ist bewusst unvollstaendig — unbekannt heisst
 * "kein Vorschlag", nie geraten.
 */

/** Q-ID → Kategorie. Jede Zeile mit Klartextnamen, sonst ist das in drei Monaten unlesbar. */
const OCCUPATION_CATEGORIES: Record<string, string> = {
  // --- Politik
  Q82955: 'premade-politicians', // Politiker*in
  Q193391: 'premade-politicians', // Diplomat*in

  // --- Sport
  Q2066131: 'premade-athletes', // Sportler*in (Oberbegriff)
  Q937857: 'premade-athletes', // Fussballspieler*in
  Q3665646: 'premade-athletes', // Basketballspieler*in
  Q10833314: 'premade-athletes', // Tennisspieler*in
  Q19204627: 'premade-athletes', // American-Football-Spieler*in
  Q10871364: 'premade-athletes', // Baseballspieler*in
  Q11774891: 'premade-athletes', // Eishockeyspieler*in
  Q11338576: 'premade-athletes', // Boxer*in
  Q10843402: 'premade-athletes', // Schwimmer*in
  Q11513337: 'premade-athletes', // Leichtathlet*in
  Q378622: 'premade-athletes', // Rennfahrer*in
  Q10349745: 'premade-athletes', // Automobilrennfahrer*in
  Q10841764: 'premade-athletes', // Formel-1-Fahrer*in
  Q13474373: 'premade-athletes', // Profiwrestler*in
  Q11303721: 'premade-athletes', // Golfer*in
  Q2125610: 'premade-athletes', // Radfahrer*in
  Q16947675: 'premade-athletes', // Turner*in
  Q13381572: 'premade-athletes', // Geraetturner*in
  Q13219587: 'premade-athletes', // Eiskunstlaeufer*in
  Q12299841: 'premade-athletes', // Cricketspieler*in
  Q14089670: 'premade-athletes', // Rugby-Union-Spieler*in
  Q11607585: 'premade-athletes', // MMA-Kaempfer*in

  // --- Anime
  // Ein Seiyu ist Synchronsprecher*in fuer Anime — die Kategorie waere sonst
  // nie befuellbar, weil Anime-Figuren keine Personen mit Beruf sind.
  Q622807: 'premade-anime', // Seiyu (japanische*r Synchronsprecher*in)
  Q191633: 'premade-anime', // Mangaka

  // --- Musik
  Q639669: 'premade-musicians', // Musiker*in
  Q177220: 'premade-musicians', // Saenger*in
  Q488205: 'premade-musicians', // Singer-Songwriter*in
  Q2252262: 'premade-musicians', // Rapper*in
  Q36834: 'premade-musicians', // Komponist*in
  Q753110: 'premade-musicians', // Songwriter*in
  Q183945: 'premade-musicians', // Musikproduzent*in
  Q855091: 'premade-musicians', // Gitarrist*in
  Q386854: 'premade-musicians', // Schlagzeuger*in
  Q486748: 'premade-musicians', // Pianist*in
  Q130857: 'premade-musicians', // DJ

  // --- Schauspiel
  Q33999: 'premade-actors', // Schauspieler*in
  Q10800557: 'premade-actors', // Filmschauspieler*in
  Q10798782: 'premade-actors', // Fernsehschauspieler*in
  Q2259451: 'premade-actors', // Theaterschauspieler*in
  Q2405480: 'premade-actors', // Synchronsprecher*in
  Q245068: 'premade-actors', // Komiker*in

  // --- Reality TV
  Q947873: 'premade-reality-tv', // Fernsehmoderator*in
  Q4610556: 'premade-reality-tv', // Model
  Q512314: 'premade-reality-tv', // Socialite
  Q2906862: 'premade-reality-tv', // Influencer*in
  Q17125263: 'premade-reality-tv', // YouTuber*in
  Q2045208: 'premade-reality-tv', // Internet-Beruehmtheit
};

/**
 * Mehrere Berufe sind der Normalfall — Ronaldo ist Fussballspieler *und* Model
 * *und* Unternehmer. Die Reihenfolge in P106 ist bedeutungslos, deshalb
 * entscheidet diese Liste: die erste passende Kategorie gewinnt.
 *
 * Sortiert nach Aussagekraft. "Model" oder "Influencer" stehen bei vielen
 * Personen zusaetzlich dran und sagen am wenigsten ueber sie aus — Reality TV
 * ist deshalb das letzte Netz, nicht das erste. Anime steht vor Schauspiel,
 * sonst faenge "Synchronsprecher*in" jeden Seiyu vorher ab.
 *
 * Schauspiel vor Musik ist eine bewusste Abwaegung, keine Wahrheit: Wikidata
 * fuehrt bei Cillian Murphy und Will Smith beides. Da die Personen hier aus
 * TMDB kommen — einer Filmdatenbank — ist "Schauspieler*in mit Band" der
 * haeufigere Fall als "Musiker*in mit Filmrolle". Umgekehrt landen Lady Gaga
 * und Beyoncé damit faelschlich bei Actors. Genau dafuer ist es ein Vorschlag
 * und keine Vorschrift.
 */
const CATEGORY_PRIORITY: readonly string[] = [
  'premade-politicians',
  'premade-athletes',
  'premade-anime',
  'premade-actors',
  'premade-musicians',
  'premade-reality-tv',
];

/**
 * Berufs-Q-IDs → Kategorie-ID, oder null wenn keiner davon bekannt ist.
 * Eine falsche Kategorie ist schlimmer als gar keine: sie wirkt still weiter,
 * wenn spaeter jemand einen Pool "nur Actors" baut.
 */
export function categoryForOccupations(occupationIds: readonly string[]): string | null {
  const matched = new Set<string>();
  for (const id of occupationIds) {
    const category = OCCUPATION_CATEGORIES[id];
    if (category) matched.add(category);
  }
  return CATEGORY_PRIORITY.find((category) => matched.has(category)) ?? null;
}
