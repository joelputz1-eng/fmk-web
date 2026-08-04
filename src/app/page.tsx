'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listEntries } from '@/lib/db/entries';
import { listLists } from '@/lib/db/lists';
import { countRounds } from '@/lib/db/rounds';
import { DEFAULT_POOL_CONFIG, MIN_POOL_SIZE } from '@/lib/game/poolBuilder';
import { stashPool } from '@/lib/game/session';
import { useVerdictLabels } from '@/lib/theme/SettingsProvider';
import { Notice } from '@/components/ui/Feedback';

interface Overview {
  entries: number;
  lists: number;
  rounds: number;
}

const MODE_CARD =
  'card group relative flex flex-col gap-3 overflow-hidden p-6 text-left transition ' +
  'hover:-translate-y-1 hover:border-dim';

export default function HomePage() {
  const router = useRouter();
  const labels = useVerdictLabels();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listEntries(), listLists(), countRounds()])
      .then(([entries, lists, rounds]) => {
        if (!cancelled) {
          setOverview({ entries: entries.length, lists: lists.length, rounds });
        }
      })
      .catch((error) => console.error('Übersicht konnte nicht geladen werden', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const playable = (overview?.entries ?? 0) >= MIN_POOL_SIZE;

  /**
   * Direkt in den Create-Modus: mit genug Einträgen sofort ins Spiel, sonst
   * dorthin, wo die fehlenden Einträge entstehen.
   */
  const enterCreateMode = () => {
    if (playable) {
      stashPool({ config: DEFAULT_POOL_CONFIG, descriptor: 'Alle Einträge' });
      router.push('/play');
    } else {
      router.push('/entries/new');
    }
  };

  return (
    <div className="space-y-12">
      {/*
       * Der Hero ist die These: die drei Urteile selbst, in ihren Farben.
       * Mit aktiviertem Safe-Labels-Schalter liest sich derselbe Hero als
       * DATE / MARRY / DUMP — das Design folgt der Einstellung.
       */}
      <section>
        <p className="eyebrow mb-5">Drei Namen. Drei Urteile. Keine Ausreden.</p>
        <h1 className="display text-[clamp(3.5rem,18vw,8.5rem)]">
          <span className="rise block text-fuck" style={{ animationDelay: '0ms' }}>
            {labels.fuck}
          </span>
          <span className="rise block text-marry" style={{ animationDelay: '90ms' }}>
            {labels.marry}
          </span>
          <span className="rise block text-kill" style={{ animationDelay: '180ms' }}>
            {labels.kill}
          </span>
        </h1>
        <p className="muted mt-6 max-w-sm">
          Läuft komplett in deinem Browser. Kein Konto, kein Server, keine Uploads — deine Fotos
          verlassen das Gerät nicht.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={enterCreateMode} className={MODE_CARD}>
          <span className="spine absolute inset-x-0 top-0" />
          <span className="eyebrow">Eigene Einträge</span>
          <span className="display text-3xl">Create</span>
          <span className="muted flex-1">
            Namen und Fotos anlegen, in Listen sortieren, losspielen.
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            {playable ? 'Jetzt spielen' : 'Erst Einträge anlegen'}
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </button>

        <Link href="/celebrities" className={MODE_CARD}>
          <span className="eyebrow">Über TMDB</span>
          <span className="display text-3xl">Promis</span>
          <span className="muted flex-1">
            Prominente suchen und in die eigenen Listen übernehmen.
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            Promis durchsuchen
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>
      </section>

      {!playable && overview !== null ? (
        <Notice tone="warning">
          Für eine Runde brauchst du mindestens {MIN_POOL_SIZE} Einträge — aktuell sind es{' '}
          {overview.entries}.
        </Notice>
      ) : null}

      <section className="space-y-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-dim">
          {overview === null ? (
            'Lade Bestand'
          ) : (
            <>
              <span className="text-ink">{overview.entries}</span> Einträge
              <span className="mx-2 text-line">/</span>
              <span className="text-ink">{overview.lists}</span> Listen
              <span className="mx-2 text-line">/</span>
              <span className="text-ink">{overview.rounds}</span> Runden
            </>
          )}
        </p>

        <div className="spine w-24 rounded-full" />

        <ol className="muted space-y-2">
          <li>
            <span className="font-mono text-xs text-dim">01</span>{' '}
            <Link href="/entries/new" className="text-ink underline underline-offset-4">
              Einträge anlegen
            </Link>{' '}
            — einzeln mit Foto oder mehrere Namen auf einmal.
          </li>
          <li>
            <span className="font-mono text-xs text-dim">02</span>{' '}
            <Link href="/lists" className="text-ink underline underline-offset-4">
              Liste erstellen
            </Link>{' '}
            und Einträge zuordnen.
          </li>
          <li>
            <span className="font-mono text-xs text-dim">03</span> Pool filtern, Runde spielen,
            Urteil kassieren.
          </li>
        </ol>
      </section>
    </div>
  );
}
