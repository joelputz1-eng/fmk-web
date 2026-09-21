import type { Verdict } from '@/lib/db/schema';

/**
 * Ziehgeste fuer die Kartenzuweisung.
 *
 * Warum nicht die HTML5-Drag-API: die feuert auf Touch-Geraeten schlicht nicht,
 * und das laesst sich nicht nachruesten. Pointer Events decken Finger, Maus und
 * Stift mit einem Codepfad ab.
 *
 * Diese Datei ist bewusst frei von React: sie rechnet nur aus, was eine Geste
 * bedeutet. Was daraus wird, entscheidet die Komponente.
 */

/**
 * Erst ab dieser Strecke gilt die Geste als Ziehen. Darunter bleibt es ein Tap
 * und waehlt die Karte aus — sonst waere jeder unruhige Finger ein Drag.
 */
export const DRAG_THRESHOLD_PX = 8;

/** Aktionszonen tragen dieses Attribut, damit die Karte sie ohne Ref findet. */
export const VERDICT_ZONE_ATTRIBUTE = 'data-verdict-zone';

export interface DragState {
  entryId: string;
  pointerId: number;
  /** Startpunkt der Geste in Viewport-Koordinaten. */
  originX: number;
  originY: number;
  /** Aktuelle Zeigerposition, Grundlage fuer das Ziehabbild. */
  x: number;
  y: number;
  /** false, solange die Schwelle nicht ueberschritten ist. */
  isDragging: boolean;
  /** Zone unter dem Zeiger, null wenn daneben. */
  target: Verdict | null;
}

export function beginDrag(entryId: string, pointerId: number, x: number, y: number): DragState {
  return {
    entryId,
    pointerId,
    originX: x,
    originY: y,
    x,
    y,
    isDragging: false,
    target: null,
  };
}

function exceedsThreshold(state: DragState, x: number, y: number): boolean {
  const dx = x - state.originX;
  const dy = y - state.originY;
  // Quadriert vergleichen — eine Wurzel pro Pointer-Move ist unnoetig.
  return dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
}

/**
 * Sucht die Aktionszone unter einem Punkt. `elementFromPoint` liefert das
 * oberste Element — das Ziehabbild muss deshalb `pointer-events: none` tragen,
 * sonst findet es immer nur sich selbst.
 */
export function zoneAtPoint(x: number, y: number): Verdict | null {
  if (typeof document === 'undefined') return null;
  const element = document.elementFromPoint(x, y);
  const zone = element?.closest(`[${VERDICT_ZONE_ATTRIBUTE}]`);
  const value = zone?.getAttribute(VERDICT_ZONE_ATTRIBUTE);
  return value === 'fuck' || value === 'marry' || value === 'kill' ? value : null;
}

/**
 * Naechster Zustand nach einer Zeigerbewegung. Gibt denselben Zustand zurueck,
 * wenn sich nichts Sichtbares geaendert hat — das spart Rerenders, solange der
 * Finger noch unterhalb der Schwelle zittert.
 */
export function moveDrag(state: DragState, x: number, y: number): DragState {
  const isDragging = state.isDragging || exceedsThreshold(state, x, y);
  if (!isDragging) return state;

  const target = zoneAtPoint(x, y);
  if (state.isDragging && state.x === x && state.y === y && state.target === target) return state;
  return { ...state, x, y, isDragging: true, target };
}

export type DragOutcome =
  /** Kurze Beruehrung ohne Bewegung — die Karte wird ausgewaehlt. */
  | { kind: 'tap' }
  /** Ueber einer Zone losgelassen. */
  | { kind: 'assign'; verdict: Verdict; entryId: string }
  /** Daneben losgelassen oder abgebrochen — es aendert sich nichts. */
  | { kind: 'cancel' };

/**
 * Was das Loslassen bedeutet. Die Zone wird noch einmal frisch ermittelt: der
 * letzte `pointermove` kann vor dem `pointerup` ausgefallen sein, etwa wenn der
 * Finger ohne Zwischenschritt abhebt.
 */
export function endDrag(state: DragState, x: number, y: number): DragOutcome {
  if (!state.isDragging && !exceedsThreshold(state, x, y)) return { kind: 'tap' };
  const verdict = zoneAtPoint(x, y);
  if (!verdict) return { kind: 'cancel' };
  return { kind: 'assign', verdict, entryId: state.entryId };
}
