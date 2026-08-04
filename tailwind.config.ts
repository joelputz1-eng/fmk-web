import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

/**
 * Farben kommen als CSS-Custom-Properties aus globals.css, damit Light/Dark
 * ueber die .dark-Klasse umschaltet, ohne dass jede Komponente dark:-Varianten
 * mitschleppen muss.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: token('surface-0'),
          1: token('surface-1'),
          2: token('surface-2'),
        },
        line: token('line'),
        ink: token('text'),
        dim: token('text-dim'),
        // Die drei Urteile sind das Farbsystem: heiss -> kostbar -> kalt.
        fuck: token('fuck'),
        marry: token('marry'),
        kill: token('kill'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
