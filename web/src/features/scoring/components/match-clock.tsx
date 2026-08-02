'use client';

import { useEffect, useState } from 'react';
import { t } from '@/shared/i18n';

/**
 * Elapsed match time.
 *
 * Ticks against the real start instant rather than counting up locally — a
 * backgrounded tab freezes timers, and a clock that under-reports by however
 * long the official's screen was off is worse than no clock.
 */
function elapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function MatchClock({ startedAt }: { startedAt: string | undefined }) {
  const [label, setLabel] = useState(() => (startedAt ? elapsed(startedAt) : '0:00'));

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setLabel(elapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return null;

  return (
    <p className="text-ink-muted tabular text-center text-xs">
      {t('scoring.elapsed')} {label}
    </p>
  );
}
