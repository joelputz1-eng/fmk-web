import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  action,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="display text-4xl sm:text-5xl">{title}</h1>
          {subtitle ? <p className="muted mt-2">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="spine mt-4 rounded-full" />
    </div>
  );
}

export function Loading({ label = 'Lädt' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-12">
      <span className="h-3 w-3 animate-ping rounded-full bg-fuck" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="spine w-16 rounded-full" />
      <p className="display text-2xl">{title}</p>
      {description ? <p className="muted max-w-sm">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-1 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-surface-0 transition hover:opacity-85"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
}) {
  const tones = {
    info: 'border-kill/40 bg-kill/[0.07] text-ink',
    warning: 'border-marry/50 bg-marry/[0.09] text-ink',
    error: 'border-fuck/50 bg-fuck/[0.09] text-ink',
  } as const;

  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
