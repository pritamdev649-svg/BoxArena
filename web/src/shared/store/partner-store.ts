import { create } from 'zustand';

interface PartnerState {
  applicationStatus: string | null;
  rejectionReason: string | null;
  isSocketConnected: boolean;
  setApplicationState: (status: string | null, reason?: string | null) => void;
  setSocketConnected: (connected: boolean) => void;
}

export const usePartnerStore = create<PartnerState>((set) => ({
  applicationStatus: null,
  rejectionReason: null,
  isSocketConnected: false,
  setApplicationState: (status, reason = null) =>
    set({ applicationStatus: status, rejectionReason: reason }),
  setSocketConnected: (connected) => set({ isSocketConnected: connected }),
}));
