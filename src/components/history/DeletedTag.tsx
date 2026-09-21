/**
 * Soft-geloeschte Personen bleiben im Verlauf sichtbar (FEATURES.md 2.4) —
 * sonst stimmen die Summen nicht mehr mit den gespielten Runden ueberein.
 * Also markieren statt verstecken.
 */
export function DeletedTag() {
  return (
    <span className="chip ml-2 border border-line bg-surface-2 align-middle font-mono text-[0.6rem] uppercase tracking-[0.14em] text-dim">
      gelöscht
    </span>
  );
}
