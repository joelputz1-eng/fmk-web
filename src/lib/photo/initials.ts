/**
 * Fallback ohne Foto: Initialen auf einer deterministisch aus dem Namen
 * gehashten Farbe. Rein render-time, nichts davon wird gespeichert.
 */

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('de');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('de');
}

/** FNV-1a — klein, stabil, keine Kollisionsgarantie noetig. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface AvatarColors {
  background: string;
  foreground: string;
}

/**
 * Der Farbton kommt aus dem Namen, Saettigung und Helligkeit sind fest. So
 * bleiben die Avatare untereinander harmonisch und funktionieren in beiden
 * Themes mit derselben hellen Schrift.
 */
export function colorsFromName(name: string): AvatarColors {
  const hue = hashString(name.trim().toLocaleLowerCase('de')) % 360;
  return {
    background: `hsl(${hue} 48% 38%)`,
    foreground: `hsl(${hue} 60% 94%)`,
  };
}
