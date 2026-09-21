import type { Verdict } from '@/lib/db/schema';

/**
 * Die Urteilsfarbe wird als Tinte benutzt (Text, Rahmen, getönte Fläche) — nie
 * als Vollfläche hinter Text. Sonst müsste die Textfarbe zwischen Hell- und
 * Dunkelmodus kippen, weil Gold und Eisblau helle, Rot dunkle Schrift braucht.
 *
 * Einzige Ausnahme ist `solid`: der gestapelte Balken im Verlauf ist reine
 * Fläche ohne Text darauf, da kippt nichts.
 *
 * Klassennamen bewusst als Literale — Tailwind muss sie statisch finden können.
 */
export const VERDICT_THEME: Record<
  Verdict,
  { text: string; border: string; tint: string; tintStrong: string; ring: string; solid: string }
> = {
  fuck: {
    text: 'text-fuck',
    border: 'border-fuck',
    tint: 'bg-fuck/[0.07]',
    tintStrong: 'bg-fuck/[0.16]',
    ring: 'ring-fuck',
    solid: 'bg-fuck',
  },
  marry: {
    text: 'text-marry',
    border: 'border-marry',
    tint: 'bg-marry/[0.07]',
    tintStrong: 'bg-marry/[0.16]',
    ring: 'ring-marry',
    solid: 'bg-marry',
  },
  kill: {
    text: 'text-kill',
    border: 'border-kill',
    tint: 'bg-kill/[0.07]',
    tintStrong: 'bg-kill/[0.16]',
    ring: 'ring-kill',
    solid: 'bg-kill',
  },
};

/** Leicht unterschiedliche Winkel — von Hand gestempelt, nicht gedruckt. */
export const STAMP_ROTATION: Record<Verdict, string> = {
  fuck: '-9deg',
  marry: '6deg',
  kill: '-5deg',
};
