import { create } from 'zustand';

/**
 * Live match scores pushed over the WebSocket.
 *
 * A Zustand store rather than component state because two different surfaces
 * want the same frame — the official's board and anyone watching — and because
 * the socket outlives any one component (AGENTS.md: React Query + Zustand for
 * global state).
 *
 * Keyed by match so a spectator can follow more than one at once.
 */
export interface LiveFrame {
  matchPublicId: string;
  state: unknown;
  receivedAt: number;
}

interface LiveScoreState {
  frames: Record<string, LiveFrame>;
  connected: boolean;
  push: (frame: Omit<LiveFrame, 'receivedAt'>) => void;
  setConnected: (connected: boolean) => void;
}

export const useLiveScoreStore = create<LiveScoreState>((set) => ({
  frames: {},
  connected: false,
  push: (frame) =>
    set((current) => ({
      frames: {
        ...current.frames,
        [frame.matchPublicId]: { ...frame, receivedAt: Date.now() },
      },
    })),
  setConnected: (connected) => set({ connected }),
}));
