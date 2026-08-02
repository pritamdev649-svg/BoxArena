'use client';

import { useEffect, useState } from 'react';
import { useLiveScoreStore } from '@/shared/store/live-score-store';
import { socketTokenAction } from '../actions';

/**
 * Subscribes to score frames for one match.
 *
 * The socket authenticates from a query-string token, which the httpOnly
 * session cookie cannot supply. So this asks the server for a one-minute,
 * socket-scoped token first — long enough to connect, useless if it leaks
 * from a proxy log.
 *
 * Frames are advisory. The scoreboard's own command responses remain the
 * source of truth for the official's device; this only keeps OTHER viewers in
 * step, so a dropped frame is corrected by the next rally rather than retried.
 */
export function LiveSubscription({ matchPublicId }: { matchPublicId: string }) {
  const push = useLiveScoreStore((store) => store.push);
  const setConnected = useLiveScoreStore((store) => store.setConnected);
  const [socketToken, setSocketToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void socketTokenAction().then((token) => {
      if (!cancelled) setSocketToken(token);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socketToken) return;

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5001/api/v1';
    /** Same host as the API, ws(s) scheme, minus the /api/v1 suffix. */
    const origin = base.replace(/\/api\/v1\/?$/u, '').replace(/^http/u, 'ws');
    const socket = new WebSocket(`${origin}/?token=${encodeURIComponent(socketToken)}`);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as {
          type?: string;
          data?: { matchPublicId?: string; state?: unknown };
        };

        if (payload.type !== 'match.score') return;
        if (payload.data?.matchPublicId !== matchPublicId) return;

        push({ matchPublicId, state: payload.data.state });
      } catch {
        /** A malformed frame must never take the scoreboard down. */
      }
    };

    return () => socket.close();
  }, [matchPublicId, socketToken, push, setConnected]);

  return null;
}
