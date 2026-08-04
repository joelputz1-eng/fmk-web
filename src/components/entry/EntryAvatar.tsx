'use client';

import { usePhotoUrl } from '@/lib/hooks/useObjectUrl';
import { InitialsAvatar } from './InitialsAvatar';

/**
 * Foto aus dem photos-Store, sonst Initialen-Fallback.
 * `className` bestimmt die Groesse — die Initialen skalieren per em mit.
 */
export function EntryAvatar({
  name,
  photoBlobId,
  className = 'h-12 w-12 rounded-full text-3xl',
}: {
  name: string;
  photoBlobId?: string | null;
  className?: string;
}) {
  const url = usePhotoUrl(photoBlobId);

  if (url) {
    // Object-URLs koennen von next/image nicht optimiert werden — bewusst <img>.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`object-cover ${className}`} />;
  }
  return <InitialsAvatar name={name} className={className} />;
}
