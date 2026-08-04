import type { Verdict } from '@/lib/db/schema';

/**
 * Die Urteilsfarbe wird als Tinte benutzt (Text, Rahmen, getönte Fläche) — nie
 * als Vollfläche hinter Text. Sonst müsste die Textfarbe zwischen Hell- und
 * Dunkelmodus kippen, weil Gold und Eisblau helle, Rot dunkle Schrift braucht.
 *
 * Klassennamen bewusst als Literale — Tailwind muss sie statisch finden können.
 */
export const VERDICT_THEME: Record<
  Verdict,
  { text: string; border: string; tint: string; tintStrong: string; ring: string }
> = {
  fuck: {
    text: 'text-fuck',
    border: 'border-fuck',
    tint: 'bg-fuck/[0.07]',
    tintStrong: 'bg-fuck/[0.16]',
    ring: 'ring-fuck',
  },
  marry: {
    text: 'text-marry',
    border: 'border-marry',
    tint: 'bg-marry/[0.07]',
    tintStrong: 'bg-marry/[0.16]',
    ring: 'ring-marry',
  },
  kill: {
    text: 'text-kill',
    border: 'border-kill',
    tint: 'bg-kill/[0.07]',
    tintStrong: 'bg-kill/[0.16]',
    ring: 'ring-kill',
  },
};

/** Leicht unterschiedliche Winkel — von Hand gestempelt, nicht gedruckt. */
export const STAMP_ROTATION: Record<Verdict, string> = {
  fuck: '-9deg',
  marry: '6deg',
  kill: '-5deg',
};
