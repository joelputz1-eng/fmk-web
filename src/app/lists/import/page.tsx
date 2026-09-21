'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EntryAvatar } from '@/components/entry/EntryAvatar';
import { Button } from '@/components/ui/Button';
import { Loading, Notice, PageHeader } from '@/components/ui/Feedback';
import {
  applyImport,
  attachPhotos,
  planImport,
  resolveCelebrities,
  type ImportOutcome,
  type ImportPlan,
} from '@/lib/db/listImport';
import {
  DECODE_ERROR_MESSAGES,
  decodeListPayload,
  type DecodeError,
  type ListPayload,
} from '@/lib/share/listPayload';

/**
 * Eine geteilte Liste uebernehmen (FEATURES.md 5.5).
 *
 * Die Daten stehen im Fragment der URL und haben nie einen Server gesehen. Sie
 * kommen trotzdem von jemand anderem — deshalb wird erst gezeigt, was ankaeme,
 * und nichts geschrieben, bevor jemand zugestimmt hat.
 */

type State =
  | { kind: 'loading' }
  | { kind: 'error'; error: DecodeError }
  | { kind: 'preview'; payload: ListPayload; plan: ImportPlan }
  | { kind: 'importing' }
  | { kind: 'done'; outcome: ImportOutcome; photosFailed: number };

export default function ImportListPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    // location.hash kommt mit fuehrendem #; der Decoder nimmt beides.
    const read = async () => {
      setState({ kind: 'loading' });
      const result = await decodeListPayload(window.location.hash);
      if (cancelled) return;
      if (!result.ok) return setState({ kind: 'error', error: result.error });

      try {
        const plan = await planImport(result.payload);
        if (!cancelled) setState({ kind: 'preview', payload: result.payload, plan });
      } catch (error) {
        console.error('Vorschau konnte nicht aufgebaut werden', error);
        if (!cancelled) setState({ kind: 'error', error: 'invalid-structure' });
      }
    };

    void read();

    /*
     * Ein zweiter Link waehrend die Seite offen ist, aendert nur das Fragment.
     * Das ist eine Navigation im selben Dokument: die Seite laedt nicht neu,
     * und ohne diesen Horcher bliebe die alte Vorschau stehen.
     */
    const onHashChange = () => void read();
    window.addEventListener('hashchange', onHashChange);

    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const confirm = async (payload: ListPayload) => {
    setState({ kind: 'importing' });
    try {
      // Erst fragen, dann schreiben: durchgefallene Promis sollen gar nicht
      // erst entstehen.
      const resolution = await resolveCelebrities(payload);
      const outcome = await applyImport(payload, resolution);
      const photosFailed = await attachPhotos(outcome.photoTargets);
      setState({ kind: 'done', outcome, photosFailed });
    } catch (error) {
      console.error('Import fehlgeschlagen', error);
      setState({ kind: 'error', error: 'invalid-structure' });
    }
  };

  if (state.kind === 'loading') return <Loading label="Lese Link …" />;

  if (state.kind === 'error') {
    return (
      <div>
        <PageHeader eyebrow="Geteilte Liste" title="Geht nicht" />
        <div className="space-y-4">
          <Notice tone="error">{DECODE_ERROR_MESSAGES[state.error]}</Notice>
          <Link href="/lists" className="muted underline underline-offset-2">
            Zu deinen Listen
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'importing') return <Loading label="Übernehme Liste …" />;

  if (state.kind === 'done') {
    const { outcome, photosFailed } = state;
    return (
      <div>
        <PageHeader eyebrow="Geteilte Liste" title="Übernommen" subtitle={outcome.listName} />
        <div className="space-y-4">
          <ul className="card divide-y divide-line p-0 text-sm">
            <Row label="Neu angelegt" value={outcome.created} />
            <Row label="Schon vorhanden, wiederverwendet" value={outcome.reused} />
            {outcome.restored > 0 ? (
              <Row label="Aus dem Papierkorb zurückgeholt" value={outcome.restored} />
            ) : null}
            {outcome.categoriesCreated > 0 ? (
              <Row label="Kategorien angelegt" value={outcome.categoriesCreated} />
            ) : null}
            {outcome.rejected > 0 ? (
              <Row label="Nicht übernommen (Altersprüfung)" value={outcome.rejected} />
            ) : null}
          </ul>

          {outcome.rejected > 0 ? (
            <Notice tone="warning">
              {outcome.rejected === 1 ? 'Eine Person' : `${outcome.rejected} Personen`} aus dem Link
              {outcome.rejected === 1 ? ' ist' : ' sind'} nicht verfügbar und wurde
              {outcome.rejected === 1 ? '' : 'n'} nicht übernommen.
            </Notice>
          ) : null}

          {outcome.withoutPhoto > 0 || photosFailed > 0 ? (
            <Notice tone="info">
              Bei {outcome.withoutPhoto + photosFailed}{' '}
              {outcome.withoutPhoto + photosFailed === 1 ? 'Promi' : 'Promis'} konnte das Bild nicht
              geladen werden — vermutlich fehlt die Verbindung. Die Einträge sind da und zeigen so
              lange ihre Initialen.
            </Notice>
          ) : null}

          <Button onClick={() => router.push(`/lists/${outcome.listId}`)}>Liste öffnen</Button>
        </div>
      </div>
    );
  }

  const { payload, plan } = state;
  return (
    <div>
      <PageHeader
        eyebrow="Geteilte Liste"
        title={plan.listName}
        subtitle={`${plan.entries.length} ${plan.entries.length === 1 ? 'Eintrag' : 'Einträge'}`}
      />

      <div className="space-y-5">
        <Notice tone="info">
          Noch ist nichts gespeichert. Beim Übernehmen entsteht eine neue Liste — deine vorhandenen
          Listen bleiben unverändert.
          {plan.existingCount > 0 ? (
            <>
              {' '}
              <strong className="font-semibold">
                {plan.existingCount} {plan.existingCount === 1 ? 'Name ist' : 'Namen sind'} bei dir
                schon vorhanden
              </strong>{' '}
              und {plan.existingCount === 1 ? 'wird' : 'werden'} wiederverwendet, statt doppelt
              angelegt zu werden.
            </>
          ) : null}
        </Notice>

        <ul className="card divide-y divide-line p-0">
          {plan.entries.map((entry, index) => (
            <li key={`${entry.name}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
              <EntryAvatar
                name={entry.name}
                photoBlobId={entry.existing?.photoBlobId}
                className="h-9 w-9 shrink-0 rounded-full text-xl"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.name}</span>
              {entry.existing ? (
                <span className="chip shrink-0 border border-line bg-surface-2 text-dim">
                  schon da
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {plan.celebrityCount > 0 ? (
          <p className="muted">
            Darunter {plan.celebrityCount} {plan.celebrityCount === 1 ? 'Promi' : 'Promis'} — deren
            Bilder werden beim Übernehmen geladen.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => void confirm(payload)}>
            Liste übernehmen
          </Button>
          <Button variant="secondary" size="lg" onClick={() => router.push('/lists')}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="muted">{label}</span>
      <span className="font-mono font-semibold text-ink">{value}</span>
    </li>
  );
}
