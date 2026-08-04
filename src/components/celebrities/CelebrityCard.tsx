'use client';

import { GENDER_LABELS } from '@/lib/db/schema';
import type { CelebrityDto } from '@/lib/tmdb/types';
import { InitialsAvatar } from '@/components/entry/InitialsAvatar';
import { Button } from '@/components/ui/Button';

/**
 * Eine Person im Ergebnis-Grid. Das Bild kommt direkt von image.tmdb.org —
 * gespeichert wird erst beim Uebernehmen.
 */
export function CelebrityCard({
  celebrity,
  imported,
  busy,
  onImport,
}: {
  celebrity: CelebrityDto;
  imported: boolean;
  busy: boolean;
  onImport: () => void;
}) {
  const meta = [celebrity.knownFor, celebrity.birthYear ? `Jg. ${celebrity.birthYear}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="card flex flex-col overflow-hidden">
      <div className="relative aspect-[2/3] bg-surface-2">
        {celebrity.thumbUrl ? (
          // Object-Fit + fixe Kachelgroesse — next/image braucht hier nichts zu optimieren.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={celebrity.thumbUrl}
            alt={celebrity.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <InitialsAvatar name={celebrity.name} className="h-full w-full text-6xl" />
        )}
        {imported ? (
          <span className="absolute left-2 top-2 chip bg-ink/85 text-surface-0">
            In deiner Sammlung
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{celebrity.name}</p>
          <p className="muted truncate">{meta || GENDER_LABELS[celebrity.gender]}</p>
        </div>
        <Button
          size="sm"
          variant={imported ? 'secondary' : 'primary'}
          className="mt-auto w-full"
          disabled={imported || busy}
          onClick={onImport}
        >
          {imported ? 'Übernommen' : busy ? 'Lädt …' : 'Übernehmen'}
        </Button>
      </div>
    </li>
  );
}
