'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Loading, Notice } from '@/components/ui/Feedback';
import { buildPayloadForList } from '@/lib/db/listShare';
import { buildShareUrl, encodeListPayload, isLinkTooLong } from '@/lib/share/listPayload';

/**
 * Teilen einer Liste (FEATURES.md 5.5). Der Link traegt die Liste komplett im
 * Fragment — es gibt keinen Server, der irgendetwas davon speichert.
 *
 * Dass der Link die Namen enthaelt, steht hier sichtbar: wer ihn weitergibt,
 * gibt die Namen weiter, und daran kann die App nichts aendern. Ein Widerruf
 * oder ein Ablaufdatum waere gelogen.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'building' }
  | { kind: 'ready'; url: string; entryCount: number }
  | { kind: 'too-long'; entryCount: number }
  | { kind: 'empty' }
  | { kind: 'error' };

export function ShareListPanel({ listId, listName }: { listId: string; listName: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  // Bestaetigung wieder einsammeln, sonst steht "Kopiert" dauerhaft da.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const build = useCallback(async () => {
    setState({ kind: 'building' });
    try {
      const payload = await buildPayloadForList(listId);
      if (!payload) return setState({ kind: 'error' });
      if (payload.e.length === 0) return setState({ kind: 'empty' });

      const encoded = await encodeListPayload(payload);
      const url = buildShareUrl(window.location.origin, encoded);

      if (isLinkTooLong(url)) {
        return setState({ kind: 'too-long', entryCount: payload.e.length });
      }
      setState({ kind: 'ready', url, entryCount: payload.e.length });
    } catch (error) {
      console.error('Teilen-Link konnte nicht erzeugt werden', error);
      setState({ kind: 'error' });
    }
  }, [listId]);

  const share = async (url: string) => {
    // navigator.share gibt es nicht ueberall, und selbst wo es existiert,
    // bricht es ab, wenn die Auswahl geschlossen wird. Beides ist kein Fehler.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: listName, text: `Liste „${listName}" für FMK`, url });
        return;
      } catch {
        // Abgebrochen oder nicht erlaubt — dann eben Zwischenablage.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Ohne Zwischenablage bleibt der Link im Feld stehen, markierbar.
      setCopied(false);
    }
  };

  if (state.kind === 'idle') {
    return (
      <Button variant="secondary" onClick={() => void build()}>
        Liste teilen
      </Button>
    );
  }

  if (state.kind === 'building') return <Loading label="Erzeuge Link …" />;

  if (state.kind === 'empty') {
    return (
      <Notice tone="warning">
        Diese Liste ist leer — es gibt nichts zu teilen. Füge erst Einträge hinzu.
      </Notice>
    );
  }

  if (state.kind === 'error') {
    return <Notice tone="error">Der Link konnte nicht erzeugt werden.</Notice>;
  }

  if (state.kind === 'too-long') {
    return (
      <Notice tone="warning">
        Mit {state.entryCount} Einträgen wird der Link zu lang — Messenger schneiden ihn unterwegs
        ab. Teile die Liste in kleinere Listen auf.
      </Notice>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="eyebrow mb-1">Link zu dieser Liste</p>
        <p className="muted">
          {state.entryCount} {state.entryCount === 1 ? 'Eintrag' : 'Einträge'}. Wer den Link öffnet,
          sieht erst eine Vorschau und entscheidet dann.
        </p>
      </div>

      {/*
       * break-all statt Scrollbalken: bei 360 px ist ein umbrechender Link
       * lesbar, ein horizontal scrollendes Feld nicht.
       */}
      <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs break-all">
        {state.url}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void share(state.url)}>Teilen</Button>
        <Button variant="secondary" onClick={() => setState({ kind: 'idle' })}>
          Schließen
        </Button>
        {copied ? <span className="eyebrow self-center">In die Zwischenablage kopiert</span> : null}
      </div>

      <Notice tone="info">
        Der Link enthält die Namen aus dieser Liste. Jeder, der ihn bekommt, kann die Liste
        übernehmen — zurücknehmen lässt sich das nicht. Fotos deiner eigenen Einträge reisen nicht
        mit; Promis bekommen ihr Bild beim Empfänger neu.
      </Notice>
    </div>
  );
}
