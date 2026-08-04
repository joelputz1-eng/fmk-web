import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/**
 * Neutrale Buttons mit Absicht: die drei Urteilsfarben bleiben dem Spiel
 * vorbehalten, sonst nutzt sich das Signal ab.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface-0 hover:opacity-85',
  secondary: 'border border-line bg-surface-1 text-ink hover:bg-surface-2',
  ghost: 'text-dim hover:bg-surface-2 hover:text-ink',
  danger: 'border border-fuck/40 text-fuck hover:bg-fuck/10',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
