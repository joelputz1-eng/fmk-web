'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveRound } from '@/lib/db/rounds';
import {
  VERDICTS,
  type CardPosition,
  type EntryRecord,
  type Verdict,
} from '@/lib/db/schema';
import { feedbackForVerdict, feedbackRoundComplete, feedbackUndo } from '@/lib/feedback';
import { DEFAULT_POOL_CONFIG, MIN_POOL_SIZE, resolvePool } from '@/lib/game/poolBuilder';
import { drawTriple, totalTriples } from '@/lib/game/roundGenerator';
import { readPool, type PendingPool } from '@/lib/game/session';
import { useSettings, useVerdictLabels } from '@/lib/theme/SettingsProvider';
import { ActionZone } from '@/components/game/ActionZone';
import { ResultScreen } from '@/components/game/ResultScreen';
import { RoundCard } from '@/components/game/RoundCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, Loading, Notice } from '@/components/ui/Feedback';

type Assignments = Record<Verdict, string | null>;

const EMPTY_ASSIGNMENTS: Assignments = { fuck: null, marry: null, kill: null };

export default function PlayPage() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const labels = useVerdictLabels();

  const [pending, setPending] = useState<PendingPool | null>(null);
  const [pool, setPool] = useState<EntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [triple, setTriple] = useState<EntryRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignments>(EMPTY_ASSIGNMENTS);
  const [undoStack, setUndoStack] = useState<Assignments[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<Verdict, EntryRecord> | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [saving, setSaving] = useState(false);

  // Benutzte Triples leben in einer Ref: sie steuern kein Rendering, und der
  // Generator braucht beim Ziehen immer den aktuellsten Stand.
  const usedTriples = useRef<Set<string>>(new Set());
  const [usedCount, setUsedCount] = useState(0);
  const initialized = useRef(false);

  const feedbackOptions = {
    sound: settings.soundEnabled,
    haptics: settings.hapticsEnabled,
  };

  const startRound = useCallback((poolEntries: EntryRecord[]) => {
    const ids = poolEntries.map((entry) => entry.id);
    const draw = drawTriple(ids, usedTriples.current);
    if (!draw) return;

    if (draw.didReset) usedTriples.current = new Set([draw.key]);
    else usedTriples.current.add(draw.key);
    setUsedCount(usedTriples.current.size);

    const byId = new Map(poolEntries.map((entry) => [entry.id, entry]));
    setTriple(draw.triple.map((id) => byId.get(id)).filter((e): e is EntryRecord => Boolean(e)));
    setAssignments(EMPTY_ASSIGNMENTS);
    setUndoStack([]);
    setSelectedId(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Ohne Pool-Config aus dem Spielstart: einfach alle Einträge nehmen.
    const pendingPool = readPool() ?? {
      config: DEFAULT_POOL_CONFIG,
      descriptor: 'Alle Einträge',
    };
    setPending(pendingPool);

    resolvePool(pendingPool.config)
      .then((entries) => {
        setPool(entries);
        if (entries.length >= MIN_POOL_SIZE) startRound(entries);
      })
      .catch((error) => {
        console.error('Pool konnte nicht geladen werden', error);
        setLoadError('Der Pool konnte nicht geladen werden.');
      })
      .finally(() => setLoading(false));
  }, [startRound]);

  const assign = (verdict: Verdict, entryId: string) => {
    if (!triple.some((entry) => entry.id === entryId)) return;
    setUndoStack((stack) => [...stack, assignments]);
    setAssignments((current) => {
      const next = { ...current };
      // Jede Karte darf nur eine Aktion haben — alte Zuweisung entfernen.
      for (const value of VERDICTS) {
        if (next[value] === entryId) next[value] = null;
      }
      next[verdict] = entryId;
      return next;
    });
    setSelectedId(null);
    feedbackForVerdict(verdict, feedbackOptions);
  };

  const clearZone = (verdict: Verdict) => {
    if (!assignments[verdict]) return;
    setUndoStack((stack) => [...stack, assignments]);
    setAssignments((current) => ({ ...current, [verdict]: null }));
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    setAssignments(undoStack[undoStack.length - 1]);
    setUndoStack(undoStack.slice(0, -1));
    setSelectedId(null);
    feedbackUndo(feedbackOptions);
  };

  const complete = async () => {
    const { fuck, marry, kill } = assignments;
    if (!fuck || !marry || !kill || saving) return;
    setSaving(true);
    try {
      await saveRound({
        listId: pending?.config.listId ?? null,
        poolDescriptor: pending?.descriptor ?? 'Alle Einträge',
        assignments: VERDICTS.map((verdict) => ({
          entryId: assignments[verdict] as string,
          verdict,
          position: triple.findIndex((entry) => entry.id === assignments[verdict]) as CardPosition,
        })),
      });

      const byId = new Map(triple.map((entry) => [entry.id, entry]));
      setResult({
        fuck: byId.get(fuck) as EntryRecord,
        marry: byId.get(marry) as EntryRecord,
        kill: byId.get(kill) as EntryRecord,
      });
      setRoundNumber((current) => current + 1);
      feedbackRoundComplete(feedbackOptions);
    } catch (error) {
      console.error('Runde konnte nicht gespeichert werden', error);
      setLoadError('Die Runde konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Baue Pool …" />;

  if (pool.length < MIN_POOL_SIZE) {
    return (
      <EmptyState
        title="Zu wenige Einträge"
        description={`Für eine Runde brauchst du mindestens ${MIN_POOL_SIZE} Einträge im Pool — aktuell sind es ${pool.length}.`}
        actionHref="/entries/new"
        actionLabel="Einträge anlegen"
      />
    );
  }

  if (result) {
    return (
      <ResultScreen
        entriesByVerdict={result}
        labels={labels}
        roundNumber={roundNumber}
        onNext={() => startRound(pool)}
        onFinish={() => router.push('/')}
      />
    );
  }

  const allAssigned = VERDICTS.every((verdict) => assignments[verdict] !== null);
  const combos = totalTriples(pool.length);

  return (
    <div className="space-y-3 sm:space-y-6">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          {/*
           * Am Handy stehen Rundennummer und Descriptor nebeneinander in einer
           * Zeile (flex-row-reverse dreht die DOM-Reihenfolge um), ab sm wieder
           * Descriptor ueber der Ueberschrift.
           */}
          <div className="flex min-w-0 flex-row-reverse items-baseline justify-end gap-2 sm:flex-col sm:items-start sm:gap-0">
            <p className="eyebrow min-w-0 truncate sm:mb-2">
              {pending?.descriptor ?? 'Alle Einträge'}
            </p>
            <h1 className="display shrink-0 text-xl sm:text-5xl">Runde {roundNumber + 1}</h1>
          </div>
          <button
            type="button"
            onClick={() => void update({ soundEnabled: !settings.soundEnabled })}
            aria-pressed={settings.soundEnabled}
            className="rounded-xl border border-line px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-dim transition hover:bg-surface-2 hover:text-ink sm:px-3 sm:py-1.5 sm:text-xs"
          >
            Ton {settings.soundEnabled ? 'an' : 'aus'}
          </button>
        </div>
        {/* Spine und Statistik sind am Handy den Platz nicht wert. */}
        <div className="spine mt-4 hidden rounded-full sm:block" />
        <p className="mt-3 hidden font-mono text-xs uppercase tracking-[0.18em] text-dim sm:block">
          <span className="text-ink">{pool.length}</span> im Pool
          <span className="mx-2 text-line">/</span>
          <span className="text-ink">{usedCount}</span> von {combos} Kombinationen gespielt
        </p>
      </header>

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}

      {/* Drei Personen vergleicht man nebeneinander — auch auf 360 px. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {triple.map((entry) => {
          const verdict = VERDICTS.find((value) => assignments[value] === entry.id) ?? null;
          return (
            <RoundCard
              key={entry.id}
              entry={entry}
              selected={selectedId === entry.id}
              verdict={verdict}
              verdictLabel={verdict ? labels[verdict] : null}
              onSelect={() =>
                setSelectedId((current) => (current === entry.id ? null : entry.id))
              }
            />
          );
        })}
      </div>

      <div className="flex gap-2">
        {VERDICTS.map((verdict) => {
          const assignedId = assignments[verdict];
          return (
            <ActionZone
              key={verdict}
              verdict={verdict}
              label={labels[verdict]}
              assigned={triple.find((entry) => entry.id === assignedId) ?? null}
              armed={selectedId !== null}
              onTap={() => {
                if (selectedId) assign(verdict, selectedId);
                else clearZone(verdict);
              }}
              onDropEntry={(entryId) => assign(verdict, entryId)}
            />
          );
        })}
      </div>

      {/*
       * Ziehen ist HTML5-Drag-and-Drop und feuert auf Touch-Geraeten nicht —
       * der Hinweis darf dort also gar nicht erst auftauchen.
       */}
      <p className="eyebrow text-center">
        Karte antippen, dann Aktion wählen
        <span className="hidden sm:inline"> — oder Karte auf die Aktion ziehen</span>
      </p>

      {/* Am Handy: primaer volle Breite, die beiden Nebenaktionen darunter. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!allAssigned || saving}
          onClick={() => void complete()}
        >
          {saving ? 'Speichert …' : 'Runde abschließen'}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <span className="sm:hidden">Zurück</span>
            <span className="hidden sm:inline">Rückgängig</span>
          </Button>
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={() => startRound(pool)}
          >
            <span className="sm:hidden">Mischen</span>
            <span className="hidden sm:inline">Neu mischen</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
