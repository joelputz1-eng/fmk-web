'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CelebrityApiError,
  fetchCelebrity,
  fetchPack,
  fetchPacks,
  isSetupError,
  searchCelebrities,
} from '@/lib/celebrities/api';
import { listCategories } from '@/lib/db/categories';
import {
  getImportedTmdbIds,
  importCelebritiesBulk,
  importCelebrity,
  type CelebrityImportInput,
} from '@/lib/db/celebrities';
import { createList, listLists } from '@/lib/db/lists';
import type { CategoryRecord, ListRecord } from '@/lib/db/schema';
import type { CelebrityDto, PackDto } from '@/lib/tmdb/types';
import { CelebrityCard } from '@/components/celebrities/CelebrityCard';
import { ImportSheet } from '@/components/celebrities/ImportSheet';
import { Button } from '@/components/ui/Button';
import { EntriesTabs } from '@/components/EntriesTabs';
import { EmptyState, Loading, Notice, PageHeader } from '@/components/ui/Feedback';

type Tab = 'search' | 'packs';

const DEBOUNCE_MS = 350;
/**
 * Jede Suche kostet serverseitig ~20 Detail-Requests fuer die Alterspruefung.
 * Ab zwei Zeichen ist die Trefferliste brauchbar — darunter lohnt der Aufwand nicht.
 */
const MIN_QUERY_LENGTH = 2;
const TARGET_LISTS_KEY = 'fmk:celebrity-target-lists';

interface Feed {
  items: CelebrityDto[];
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  error: CelebrityApiError | null;
}

const EMPTY_FEED: Feed = {
  items: [],
  page: 0,
  totalPages: 0,
  loading: false,
  loadingMore: false,
  error: null,
};

function toImportInput(celebrity: CelebrityDto, categoryIds: string[]): CelebrityImportInput {
  return {
    tmdbId: celebrity.tmdbId,
    name: celebrity.name,
    gender: celebrity.gender,
    profileUrl: celebrity.profileUrl,
    categoryIds,
  };
}

/** Nachladen ohne Dubletten — TMDB wiederholt Personen ueber Seitengrenzen hinweg. */
function mergeItems(current: CelebrityDto[], next: CelebrityDto[]): CelebrityDto[] {
  const known = new Set(current.map((item) => item.tmdbId));
  return [...current, ...next.filter((item) => !known.has(item.tmdbId))];
}

function readStoredListIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TARGET_LISTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export default function CelebritiesPage() {
  const [tab, setTab] = useState<Tab>('search');

  const [lists, setLists] = useState<ListRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [lastListIds, setLastListIds] = useState<string[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchFeed, setSearchFeed] = useState<Feed>(EMPTY_FEED);

  const [packs, setPacks] = useState<PackDto[]>([]);
  const [packsError, setPacksError] = useState<CelebrityApiError | null>(null);
  const [packsLoading, setPacksLoading] = useState(true);
  const [activePack, setActivePack] = useState<PackDto | null>(null);
  const [packFeed, setPackFeed] = useState<Feed>(EMPTY_FEED);

  const [pending, setPending] = useState<{ items: CelebrityDto[]; title: string } | null>(null);
  /** Wikidata-Kategorievorschlag fuer den Einzelimport; beim Pack immer leer. */
  const [suggestion, setSuggestion] = useState<{ categoryId: string | null; loading: boolean }>({
    categoryId: null,
    loading: false,
  });
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Laufende Requests abbrechen, wenn Query/Pack wechselt.
  const searchAbort = useRef<AbortController | null>(null);
  const packAbort = useRef<AbortController | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);

  const reloadLocalState = useCallback(async () => {
    const [loadedLists, loadedCategories, loadedIds] = await Promise.all([
      listLists(),
      listCategories(),
      getImportedTmdbIds(),
    ]);
    setLists(loadedLists);
    setCategories(loadedCategories);
    setImportedIds(loadedIds);
    return loadedLists;
  }, []);

  /**
   * Der Dialog geht sofort auf; der Beruf wird nebenher geholt. Faellt Wikidata
   * aus, bleibt es schlicht bei "kein Vorschlag" — kein Banner, kein Blockieren.
   */
  const loadSuggestion = (celebrity: CelebrityDto) => {
    suggestAbort.current?.abort();
    const controller = new AbortController();
    suggestAbort.current = controller;
    setSuggestion({ categoryId: null, loading: true });

    fetchCelebrity(celebrity.tmdbId, controller.signal)
      .then((detail) => setSuggestion({ categoryId: detail.suggestedCategoryId, loading: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSuggestion({ categoryId: null, loading: false });
      });
  };

  const closeSheet = () => {
    suggestAbort.current?.abort();
    setPending(null);
    setSuggestion({ categoryId: null, loading: false });
  };

  useEffect(() => {
    reloadLocalState()
      .then((loadedLists) => {
        const known = new Set(loadedLists.map((list) => list.id));
        setLastListIds(readStoredListIds().filter((id) => known.has(id)));
      })
      .catch((error) => {
        console.error('Lokale Daten konnten nicht geladen werden', error);
        setDbError('Die lokale Datenbank ist nicht erreichbar.');
      });
  }, [reloadLocalState]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPacks(controller.signal)
      .then(setPacks)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof CelebrityApiError) setPacksError(error);
      })
      .finally(() => setPacksLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    searchAbort.current?.abort();
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setSearchFeed(EMPTY_FEED);
      return;
    }

    const controller = new AbortController();
    searchAbort.current = controller;
    setSearchFeed({ ...EMPTY_FEED, loading: true });

    searchCelebrities(debouncedQuery, 1, controller.signal)
      .then((response) =>
        setSearchFeed({
          items: response.results,
          page: response.page,
          totalPages: response.totalPages,
          loading: false,
          loadingMore: false,
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSearchFeed({
          ...EMPTY_FEED,
          error: error instanceof CelebrityApiError ? error : null,
        });
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const loadMoreSearch = () => {
    if (searchFeed.loadingMore || searchFeed.page >= searchFeed.totalPages) return;
    setSearchFeed((feed) => ({ ...feed, loadingMore: true }));
    searchCelebrities(debouncedQuery, searchFeed.page + 1)
      .then((response) =>
        setSearchFeed((feed) => ({
          ...feed,
          items: mergeItems(feed.items, response.results),
          page: response.page,
          totalPages: response.totalPages,
          loadingMore: false,
        })),
      )
      .catch((error: unknown) =>
        setSearchFeed((feed) => ({
          ...feed,
          loadingMore: false,
          error: error instanceof CelebrityApiError ? error : null,
        })),
      );
  };

  const openPack = (pack: PackDto) => {
    packAbort.current?.abort();
    const controller = new AbortController();
    packAbort.current = controller;

    setActivePack(pack);
    setPackFeed({ ...EMPTY_FEED, loading: true });

    fetchPack(pack.id, 1, controller.signal)
      .then((response) =>
        setPackFeed({
          items: response.results,
          page: response.page,
          totalPages: response.totalPages,
          loading: false,
          loadingMore: false,
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPackFeed({ ...EMPTY_FEED, error: error instanceof CelebrityApiError ? error : null });
      });
  };

  const loadMorePack = () => {
    if (!activePack || packFeed.loadingMore || packFeed.page >= packFeed.totalPages) return;
    setPackFeed((feed) => ({ ...feed, loadingMore: true }));
    fetchPack(activePack.id, packFeed.page + 1)
      .then((response) =>
        setPackFeed((feed) => ({
          ...feed,
          items: mergeItems(feed.items, response.results),
          page: response.page,
          totalPages: response.totalPages,
          loadingMore: false,
        })),
      )
      .catch((error: unknown) =>
        setPackFeed((feed) => ({
          ...feed,
          loadingMore: false,
          error: error instanceof CelebrityApiError ? error : null,
        })),
      );
  };

  const closePack = () => {
    packAbort.current?.abort();
    setActivePack(null);
    setPackFeed(EMPTY_FEED);
  };

  const handleConfirmImport = async (listIds: string[], categoryIds: string[]) => {
    if (!pending) return;
    setImporting(true);
    setSheetError(null);
    try {
      const inputs = pending.items.map((item) => toImportInput(item, categoryIds));
      let photoFailures = 0;

      if (inputs.length === 1) {
        const result = await importCelebrity(inputs[0], { listIds });
        photoFailures = result.photoFailed ? 1 : 0;
      } else {
        setProgress({ done: 0, total: inputs.length });
        const result = await importCelebritiesBulk(inputs, {
          listIds,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        photoFailures = result.photoFailures;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TARGET_LISTS_KEY, JSON.stringify(listIds));
      }
      setLastListIds(listIds);
      await reloadLocalState();

      const listNames = lists
        .filter((list) => listIds.includes(list.id))
        .map((list) => list.name)
        .join(', ');
      setStatus(
        `${inputs.length === 1 ? pending.items[0].name : `${inputs.length} Personen`} übernommen${
          listNames ? ` → ${listNames}` : ''
        }${photoFailures > 0 ? ` (${photoFailures}× ohne Foto)` : ''}.`,
      );
      closeSheet();
    } catch (error) {
      console.error('Import fehlgeschlagen', error);
      setSheetError('Der Import ist fehlgeschlagen. Bitte nochmal versuchen.');
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const packImportable = useMemo(
    () => packFeed.items.filter((item) => !importedIds.has(item.tmdbId)),
    [packFeed.items, importedIds],
  );

  // Fehlender Key ist kein Fehlerzustand, sondern ein Setup-Hinweis.
  const searchSetupError =
    searchFeed.error && isSetupError(searchFeed.error) ? searchFeed.error : null;
  const packsSetupError = packsError && isSetupError(packsError) ? packsError : null;

  const renderGrid = (items: CelebrityDto[]) => (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((celebrity) => (
        <CelebrityCard
          key={celebrity.tmdbId}
          celebrity={celebrity}
          imported={importedIds.has(celebrity.tmdbId)}
          busy={importing}
          onImport={() => {
            setSheetError(null);
            setStatus(null);
            setPending({ items: [celebrity], title: celebrity.name });
            loadSuggestion(celebrity);
          }}
        />
      ))}
    </ul>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Über TMDB"
        title="Promis"
        subtitle="Prominente suchen oder in Packs stöbern und in eigene Listen übernehmen."
      />

      <EntriesTabs />

      {dbError ? (
        <div className="mb-4">
          <Notice tone="error">{dbError}</Notice>
        </div>
      ) : null}

      {status ? (
        <div className="mb-4">
          <Notice tone="info">{status}</Notice>
        </div>
      ) : null}

      <div className="mb-5 inline-flex rounded-xl border border-line bg-surface-1 p-1">
        {(['search', 'packs'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-lg px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] transition ${
              tab === value ? 'bg-ink text-surface-0' : 'text-dim hover:text-ink'
            }`}
          >
            {value === 'search' ? 'Suche' : 'Packs'}
          </button>
        ))}
      </div>

      {tab === 'search' ? (
        <section>
          <input
            className="input mb-4"
            type="search"
            placeholder="Promi suchen, z.B. „Cillian Murphy“ …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {searchSetupError ? (
            <SetupNotice message={searchSetupError.message} />
          ) : searchFeed.error && searchFeed.items.length === 0 ? (
            <Notice tone="error">{searchFeed.error.message}</Notice>
          ) : searchFeed.loading ? (
            <Loading label="Suche bei TMDB …" />
          ) : debouncedQuery.length < MIN_QUERY_LENGTH ? (
            <EmptyState
              title="Wen suchst du?"
              description="Tipp einen Namen ein. Personen ohne hinterlegtes Geburtsdatum und alle unter 18 werden serverseitig aussortiert."
            />
          ) : searchFeed.items.length === 0 ? (
            <EmptyState
              title="Keine Treffer"
              description="Andere Schreibweise probieren — oder die Person hat bei TMDB kein Geburtsdatum und fällt damit aus dem Ergebnis."
            />
          ) : (
            <>
              {renderGrid(searchFeed.items)}
              {/* Fehler beim Nachladen: die schon geladenen Treffer bleiben stehen. */}
              {searchFeed.error ? (
                <div className="mt-4">
                  <Notice tone="error">{searchFeed.error.message}</Notice>
                </div>
              ) : null}
              {searchFeed.page < searchFeed.totalPages ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="secondary"
                    disabled={searchFeed.loadingMore}
                    onClick={loadMoreSearch}
                  >
                    {searchFeed.loadingMore ? 'Lädt …' : 'Mehr laden'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section>
          {packsSetupError ? (
            <SetupNotice message={packsSetupError.message} />
          ) : packsError ? (
            <Notice tone="error">{packsError.message}</Notice>
          ) : packsLoading ? (
            <Loading label="Lade Packs …" />
          ) : !activePack ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {packs.map((pack) => (
                <li key={pack.id}>
                  <button
                    type="button"
                    onClick={() => openPack(pack)}
                    className="card w-full p-4 text-left transition hover:bg-surface-2"
                  >
                    <div className="spine mb-3 w-12 rounded-full" />
                    <p className="display text-xl">{pack.name}</p>
                    <p className="muted mt-1">{pack.description}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={closePack}
                    className="eyebrow transition hover:text-ink"
                  >
                    ← Alle Packs
                  </button>
                  <p className="display mt-1 text-2xl">{activePack.name}</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={packImportable.length === 0 || importing}
                  onClick={() => {
                    setSheetError(null);
                    setStatus(null);
                    // Pack-Import fragt bewusst kein Wikidata — kein Vorschlag.
                    setSuggestion({ categoryId: null, loading: false });
                    setPending({
                      items: packImportable,
                      title: `${activePack.name}: ${packImportable.length} Personen`,
                    });
                  }}
                >
                  Alle übernehmen ({packImportable.length})
                </Button>
              </div>

              {packFeed.error && isSetupError(packFeed.error) ? (
                <SetupNotice message={packFeed.error.message} />
              ) : packFeed.error && packFeed.items.length === 0 ? (
                <Notice tone="error">{packFeed.error.message}</Notice>
              ) : packFeed.loading ? (
                <Loading label="Lade Pack …" />
              ) : packFeed.items.length === 0 ? (
                <EmptyState
                  title="Dieses Pack ist gerade leer"
                  description="Nach der Alterssicherung ist auf dieser Seite niemand übrig geblieben."
                />
              ) : (
                <>
                  {renderGrid(packFeed.items)}
                  {packFeed.error ? (
                    <div className="mt-4">
                      <Notice tone="error">{packFeed.error.message}</Notice>
                    </div>
                  ) : null}
                  {packFeed.page < packFeed.totalPages ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="secondary"
                        disabled={packFeed.loadingMore}
                        onClick={loadMorePack}
                      >
                        {packFeed.loadingMore ? 'Lädt …' : 'Mehr laden'}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </section>
      )}

      {pending ? (
        <ImportSheet
          title={pending.title}
          subtitle={
            pending.items.length === 1
              ? 'In welche Liste soll die Person?'
              : /* Ehrlich statt stillschweigend anders: beim Pack fragt die App
                 * keine Berufe ab — das waeren zu viele Requests auf einmal. */
                `${pending.items.length} Personen übernehmen — Bilder werden lokal gespeichert. ` +
                'Kategorien vergibt der Pack-Import keine; die lassen sich später unter Einträge ergänzen.'
          }
          lists={lists}
          defaultListIds={lastListIds}
          categories={categories}
          allowCategories={pending.items.length === 1}
          suggestedCategoryId={suggestion.categoryId}
          suggestionPending={suggestion.loading}
          busy={importing}
          progress={progress}
          error={sheetError}
          onCreateList={async (name) => {
            const list = await createList(name);
            await reloadLocalState();
            return list;
          }}
          onCategoryCreated={(category) => setCategories((prev) => [...prev, category])}
          onCancel={() => {
            if (importing) return;
            closeSheet();
            setSheetError(null);
          }}
          onConfirm={(listIds, categoryIds) => void handleConfirmImport(listIds, categoryIds)}
        />
      ) : null}

      <TmdbAttribution />
    </div>
  );
}

/**
 * Fehlender/abgelehnter Key ist ein Setup-Schritt, kein Absturz.
 *
 * Der Name der Env-Variable steht hier bewusst nicht ausgeschrieben: die
 * Abnahme prueft per grep, dass er im Client-Bundle nicht vorkommt. Wie das
 * Feld heisst, dokumentiert .env.local.example.
 */
function SetupNotice({ message }: { message: string }) {
  return (
    <Notice tone="warning">
      <p className="font-semibold">{message}</p>
      <p className="mt-1">
        Trag einen TMDB-v3-Key in <code className="font-mono text-xs">.env.local</code> ein und
        starte den Dev-Server neu. Welcher Eintrag gemeint ist und woher der Key kommt, steht in{' '}
        <code className="font-mono text-xs">.env.local.example</code>. Der Rest der App funktioniert
        ohne Key ganz normal weiter.
      </p>
    </Notice>
  );
}

/** Pflichtangabe laut TMDB-Nutzungsbedingungen (4.3). */
function TmdbAttribution() {
  return (
    <footer className="mt-10 border-t border-line pt-5">
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 font-display text-sm uppercase tracking-[0.14em] transition hover:bg-surface-2"
      >
        <span
          aria-hidden
          className="h-3 w-8 rounded-sm"
          style={{ background: 'linear-gradient(90deg, #90cea1, #01b4e4)' }}
        />
        The Movie Database
      </a>
      <p className="muted mt-2 max-w-prose">
        Diese Anwendung nutzt die TMDB-API, ist aber nicht von TMDB unterstützt oder zertifiziert.
      </p>
    </footer>
  );
}
