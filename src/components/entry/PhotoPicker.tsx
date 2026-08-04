'use client';

import { useRef, useState } from 'react';
import { useObjectUrl } from '@/lib/hooks/useObjectUrl';
import { processPhoto } from '@/lib/photo/resize';
import { Button } from '@/components/ui/Button';
import { InitialsAvatar } from './InitialsAvatar';

/**
 * Ein einziger File-Input deckt Kamera (mobil) und Dateiauswahl (Desktop) ab.
 * Das gewaehlte Bild wird sofort auf 512px Square-WebP eingedampft — der
 * Aufrufer bekommt nur noch den fertigen Blob.
 */
export function PhotoPicker({
  value,
  onChange,
  name,
}: {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
  name: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useObjectUrl(value);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await processPhoto(file));
    } catch (cause) {
      console.error(cause);
      setError('Bild konnte nicht verarbeitet werden.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Vorschau"
          className="h-20 w-20 rounded-xl object-cover ring-1 ring-line"
        />
      ) : (
        <InitialsAvatar
          name={name || '?'}
          className="h-20 w-20 rounded-xl text-5xl ring-1 ring-line"
        />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Verarbeite …' : value ? 'Foto ändern' : 'Foto wählen'}
          </Button>
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              Entfernen
            </Button>
          ) : null}
        </div>
        <p className="muted">Wird automatisch quadratisch zugeschnitten (512 px, WebP).</p>
        {error ? <p className="text-sm text-fuck">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
