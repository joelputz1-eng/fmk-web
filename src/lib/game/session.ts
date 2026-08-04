import { isPoolConfig, type PoolConfig } from './poolBuilder';

/**
 * Pool-Config wird beim Spielstart ueber sessionStorage an /play uebergeben —
 * so bleibt sie ueber einen Reload von /play erhalten, ohne in der URL zu landen.
 */
const SESSION_KEY = 'fmk:pending-pool';

export interface PendingPool {
  config: PoolConfig;
  /** Menschenlesbarer Text fuer Header + RoundRecord.poolDescriptor. */
  descriptor: string;
}

export function stashPool(pending: PendingPool): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending));
}

/** Liest die Config, ohne sie zu loeschen — /play muss reload-fest sein. */
export function readPool(): PendingPool | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      isPoolConfig((parsed as PendingPool).config) &&
      typeof (parsed as PendingPool).descriptor === 'string'
    ) {
      return parsed as PendingPool;
    }
  } catch {
    // Kaputter Eintrag — wie "nicht vorhanden" behandeln.
  }
  return null;
}

export function clearPool(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}
