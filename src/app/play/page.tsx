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
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-2 truncate">{pending?.descriptor ?? 'Alle Einträge'}</p>
            <h1 className="display text-4xl sm:text-5xl">Runde {roundNumber + 1}</h1>
          </div>
          <button
            type="button"
            onClick={() => void update({ soundEnabled: !settings.soundEnabled })}
            aria-pressed={settings.soundEnabled}
            className="rounded-xl border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-dim transition hover:bg-surface-2 hover:text-ink"
          >
            Ton {settings.soundEnabled ? 'an' : 'aus'}
          </button>
        </div>
        <div className="spine mt-4 rounded-full" />
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-dim">
          <span className="text-ink">{pool.length}</span> im Pool
          <span className="mx-2 text-line">/</span>
          <span className="text-ink">{usedCount}</span> von {combos} Kombinationen gespielt
        </p>
      </header>

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      <p className="eyebrow text-center">
        Karte antippen, dann Aktion wählen — oder Karte auf die Aktion ziehen
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={!allAssigned || saving} onClick={() => void complete()}>
          {saving ? 'Speichert …' : 'Runde abschließen'}
        </Button>
        <Button variant="secondary" onClick={undo} disabled={undoStack.length === 0}>
          Rückgängig
        </Button>
        <Button variant="secondary" onClick={() => startRound(pool)}>
          Neu mischen
        </Button>
      </div>
    </div>
  );
}
