'use client';

import { useEffect, useState } from 'react';
import { getPhotoBlob } from '@/lib/db/entries';

/**
 * Blob → Object-URL, mit revokeObjectURL beim Unmount bzw. Blob-Wechsel.
 * Wird an vielen Stellen gebraucht — ohne den Hook leaken die URLs.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [blob]);

  return url;
}

/** Laedt einen Foto-Blob aus dem photos-Store. */
export function usePhotoBlob(photoBlobId: string | null | undefined): Blob | null {
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!photoBlobId) {
      setBlob(null);
      return;
    }
    let cancelled = false;
    getPhotoBlob(photoBlobId)
      .then((loaded) => {
        if (!cancelled) setBlob(loaded ?? null);
      })
      .catch(() => {
        if (!cancelled) setBlob(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoBlobId]);

  return blob;
}

/** Bequemer Wrapper: Foto-ID → anzeigbare URL. */
export function usePhotoUrl(photoBlobId: string | null | undefined): string | null {
  return useObjectUrl(usePhotoBlob(photoBlobId));
}
