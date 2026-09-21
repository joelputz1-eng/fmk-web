'use client';

import { useEffect } from 'react';

/**
 * Meldet den Service Worker an — nur im Produktionsbuild.
 *
 * In `next dev` waere er ein Ärgernis: der Dev-Server liefert Assets unter
 * wechselnden Adressen aus, und ein Worker, der dazwischenfunkt, macht
 * Fehlersuche zur Raterei.
 *
 * Rendert nichts.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    // Erst nach dem Laden registrieren, damit die Anmeldung nicht mit dem
    // ersten Rendern um Bandbreite streitet.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (cancelled) return;
          // Bei jedem Start nachsehen, ob es eine neue Fassung gibt. Sie
          // uebernimmt erst beim naechsten Start — siehe public/sw.js.
          void registration.update();
        })
        .catch((error) => {
          console.error('Service Worker konnte nicht registriert werden', error);
        });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
