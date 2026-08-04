# Fuck Marry Kill — Feature Spec (v1)

**Stack:** React Native + Expo (iOS + Android)
**Data:** SQLite local-first, Supabase sync (auth + Postgres + Storage)
**Celebrity content:** TMDB API (people endpoints + profile images), cached locally
**Play mode v1:** Solo / pass-the-phone

---

## 1. Core game loop

| # | Feature | Notes |
|---|---|---|
| 1.1 | Round generator | Picks 3 distinct entries from the active pool. No repeat triple until pool exhausted. |
| 1.2 | Card UI | 3 cards: photo, name, optional tags. Portrait stack or 3-up grid. |
| 1.3 | Assign F / M / K | Tap a card → tap an action, or drag card onto action zone. Each action used exactly once per round. |
| 1.4 | Undo / reshuffle | Undo last assignment; "skip round" button rerolls the triple. |
| 1.5 | Result screen | Shows the locked-in verdict, then "Next round". |
| 1.6 | Round history | Chronological log of every completed round + verdicts. |
| 1.7 | Haptics + sound | Distinct feedback per action. Global mute toggle. |

## 2. Entry database (create mode)

| # | Feature | Notes |
|---|---|---|
| 2.1 | Add entry | Name (required), photo, gender, category tags, free-text note. |
| 2.2 | Photo sources | Camera roll, camera, contacts avatar, or generated initials placeholder. Auto-crop to square, resize + compress on save. |
| 2.3 | Import from contacts | Multi-select contacts → bulk create entries (name + avatar). Permission-gated. |
| 2.4 | Edit / delete entry | Soft delete so history stays intact. |
| 2.5 | Bulk add | Paste a list of names → creates entries without photos. |
| 2.6 | Entry list screen | Search, sort (name / recently added / most played), filter by category or gender. |
| 2.7 | Duplicate detection | Warn on identical name in same list. |

## 3. Lists & categories

| # | Feature | Notes |
|---|---|---|
| 3.1 | User-created lists | e.g. "Uni friends", "Work". An entry can belong to multiple lists. |
| 3.2 | User-created categories/tags | Free-form, color-coded, reusable across entries. |
| 3.3 | Premade categories | Ship a starter set (Actors, Musicians, Athletes, Reality TV, Anime, Politicians…). |
| 3.4 | Pool builder | Before a game: pick list(s) + include/exclude categories + gender filter → preview count. |
| 3.5 | Minimum-size guard | Block start if pool < 3, prompt to add more. |

## 4. Celebrity mode (premade)

| # | Feature | Notes |
|---|---|---|
| 4.1 | TMDB-backed packs | Popular people, by department (acting/music/directing), by decade, by popularity threshold. |
| 4.2 | In-app celeb search | Search TMDB → add a specific celeb into a personal list. |
| 4.3 | Image + metadata cache | Store profile URL + local file cache so mode works offline after first load. Respect TMDB attribution requirements. |
| 4.4 | Pack refresh | Periodic background refresh of pack contents. |
| 4.5 | Mixed mode | Optionally blend celebs with the user's own entries in one pool. |
| 4.6 | Content safety | Hard filter: exclude anyone under 18 (TMDB birthday field), block missing-birthday people from packs. **Non-negotiable.** |

## 5. Sync & account

| # | Feature | Notes |
|---|---|---|
| 5.1 | Anonymous-first | App fully usable with no account. Sign-in is optional upgrade. |
| 5.2 | Auth | Supabase: Apple Sign-In (required by Apple if any social login exists), Google, email magic link. |
| 5.3 | Sync engine | Last-write-wins per row with `updated_at`; local SQLite is source of truth, push/pull queue on reconnect. |
| 5.4 | Photo upload | Supabase Storage, signed URLs, per-user bucket path. |
| 5.5 | Share a list | Export/import via share code or deep link. Read-only copy on import. |
| 5.6 | Delete account + data | Full wipe endpoint. Required for App Store. |

## 6. Stats & extras

| # | Feature | Notes |
|---|---|---|
| 6.1 | Per-entry stats | Times shown, F/M/K counts, "most married", "most killed". |
| 6.2 | Leaderboards | Ranking within a list by each verdict type. |
| 6.3 | Share result card | Render round result to an image → native share sheet. Watermarked. |
| 6.4 | Streak / session summary | "You played 12 rounds — here's your top 3." |

## 7. Settings

| # | Feature | Notes |
|---|---|---|
| 7.1 | Safe mode labels | Toggle "Fuck/Marry/Kill" → "Date/Marry/Dump" for a softer, store-friendlier variant. |
| 7.2 | Gender preference | Show only men / only women / all / non-binary inclusive. |
| 7.3 | Theme | Light / dark / system. |
| 7.4 | Language | i18n scaffold, DE + EN at launch. |
| 7.5 | Privacy | Local-only mode switch, clear cache, export data as JSON. |

## 8. Monetisation (optional, later)

- Free: unlimited own entries, 2 celeb packs.
- Pro (one-off or subscription): all celeb packs, unlimited lists, cloud sync, no ads, custom themes.
- RevenueCat for IAP handling.

---

## Data model (sketch)

```
users        id, auth_id, created_at
entries      id, user_id, name, photo_url, photo_local, gender, note, is_celebrity,
             tmdb_id, deleted_at, created_at, updated_at
categories   id, user_id, name, color, is_premade
entry_cat    entry_id, category_id
lists        id, user_id, name, updated_at
list_entry   list_id, entry_id
rounds       id, user_id, list_id, played_at
round_items  round_id, entry_id, verdict (fuck|marry|kill), position
settings     user_id, safe_labels, gender_filter, theme, locale
```

---

## Build order

1. Expo project + navigation + SQLite (Drizzle or expo-sqlite) + theming
2. Entry CRUD + photo picker + list/category screens
3. Core game loop with local data — **playable milestone**
4. Stats + history
5. TMDB integration + celeb packs + offline image cache
6. Supabase auth + sync + storage
7. Share cards, settings, i18n
8. Store prep: age rating, screenshots, privacy manifest

---

## Open risks / decisions needed

1. **App Store name.** Apple will almost certainly reject "Fuck Marry Kill" as the display name. Plan: store name "FMK — Marry Date Dump" or similar, real title inside the app. Needs a decision before store assets.
2. **Age rating.** 17+ / PEGI 16 either way. Ratings questionnaire must be answered honestly (sexual themes, references to violence in the "kill" wording).
3. **TMDB terms.** Free for non-commercial with attribution; commercial use needs their approval. If the app ever charges money, contact TMDB or switch to licensed images.
4. **Photos of private people.** Users uploading photos of friends is GDPR-relevant if it hits your server. Local-only photos avoid this entirely — consider making cloud photo sync opt-in and text-only sync the default.
5. **Harassment vector.** Someone can build a list about a real person and share it. Mitigations: no public discovery, share only via explicit code, report/block if sharing ever becomes social.
```

---

## Nachtrag Phase 4 (TMDB-Anbindung, gebaut)

Umgesetzt: 4.1 Packs, 4.2 Suche, 4.3 lokaler Bild-Cache + Attribution, 4.5 Mixed Mode
(Herkunfts-Filter im Pool-Builder), 4.6 Alterssicherung. Beim Bauen aufgefallen —
bewusst *nicht* umgesetzt, gehört in eine spätere Runde:

1. **4.4 Pack-Refresh fehlt (out of scope).** Packs werden bei jedem Öffnen live geholt;
   gecacht wird nur serverseitig (Next-Data-Cache 24 h + Prozess-Cache für die
   Personen-Details). Offline ist damit alles nutzbar, was schon *übernommen* wurde —
   das Browsen der Packs selbst braucht Netz.
2. **`tmdbCache`-Store weiterhin ungenutzt.** Der Detail-Cache liegt serverseitig. Wenn
   Packs offline browsbar werden sollen, ist dieser Store der richtige Ort dafür.
3. **Kein „Musik“-Pack.** TMDB hat für Personen kein `/discover`, nur `/person/popular`,
   `/trending/person/*` und `/search/person`. Ein Department-Filter auf „Sound“ über
   Popular liefert praktisch leere Seiten. Für ein echtes Musiker-Pack braucht es eine
   andere Quelle (MusicBrainz o.ä.) oder eine handkuratierte ID-Liste.
4. **Alterssicherung kostet N+1 Requests.** Weil `/search/person` und `/person/popular`
   kein `birthday` liefern, wird jeder Kandidat einzeln über `/person/{id}` angereichert
   (8 parallel, gecacht). Für eine Single-User-App völlig okay; bei echtem Traffic wäre
   ein persistenter Cache (KV/Redis) oder eine vorberechnete Allowlist der nächste Schritt.
   Nebeneffekt: Personen ohne gepflegtes Geburtsdatum bei TMDB — überdurchschnittlich oft
   Musiker und Sportler — tauchen nirgends auf. Das ist gewollt (4.6), macht die
   Trefferlisten aber schmaler als bei TMDB selbst.
5. **TMDB-Logo ist derzeit ein Textlink** in den Markenfarben. Vor einem Release gehört das
   offizielle Asset aus dem TMDB-Branding-Kit nach `/public` und in die Attribution.
   Kommerzielle Nutzung bleibt genehmigungspflichtig (siehe „Open risks“ Punkt 3).
