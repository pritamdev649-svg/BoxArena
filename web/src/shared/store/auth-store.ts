import { create } from 'zustand';

interface AuthUser {
  fullName: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string | null, user: AuthUser | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => set({ token, user }),
  clearSession: () => set({ token: null, user: null }),
}));
