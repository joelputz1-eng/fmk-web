'use client';

import { useEffect, useState } from 'react';
import { countRounds } from '@/lib/db/rounds';
import { Loading, Notice, PageHeader } from '@/components/ui/Feedback';

/** Platzhalter — der Rundenverlauf und die Stats kommen in Phase 3. */
export default function HistoryPage() {
  const [rounds, setRounds] = useState<number | null>(null);

  useEffect(() => {
    countRounds()
      .then(setRounds)
      .catch((error) => console.error('Rundenzahl konnte nicht geladen werden', error));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Archiv" title="Verlauf" subtitle="Gespielte Runden und Statistiken." />
      {rounds === null ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="card px-6 py-10 text-center">
            <div className="display text-7xl sm:text-8xl">{rounds}</div>
            <p className="eyebrow mt-3">
              {rounds === 1 ? 'gespielte Runde' : 'gespielte Runden'}
            </p>
          </div>
          <Notice tone="info">
            Chronologischer Verlauf, Statistiken pro Eintrag und Ranglisten kommen in Phase 3. Die
            Runden werden aber schon jetzt vollständig gespeichert.
          </Notice>
        </div>
      )}
    </div>
  );
}
