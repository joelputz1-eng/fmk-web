import { colorsFromName, initialsOf } from '@/lib/photo/initials';

/** Fallback ohne Foto: Initialen auf deterministisch aus dem Namen gehashter Farbe. */
export function InitialsAvatar({ name, className = '' }: { name: string; className?: string }) {
  const { background, foreground } = colorsFromName(name);
  return (
    <div
      aria-hidden
      style={{ backgroundColor: background, color: foreground }}
      className={`flex select-none items-center justify-center font-display uppercase ${className}`}
    >
      <span className="text-[0.42em] leading-none">{initialsOf(name)}</span>
    </div>
  );
}
