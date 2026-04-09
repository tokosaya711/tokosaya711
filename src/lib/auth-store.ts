import { create } from 'zustand';
import type { JWTPayload } from '@/lib/auth';
import { useFeatureStore } from './feature-store';

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,
  login: (token, user) => {
    safeSetItem('pos_token', token);
    safeSetItem('pos_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true, hydrated: true });
  },
  logout: () => {
    safeRemoveItem('pos_token');
    safeRemoveItem('pos_user');
    set({ token: null, user: null, isAuthenticated: false, hydrated: true });
    // Reset feature permissions so next login starts fresh
    useFeatureStore.getState().resetFeatures();
  },
  hydrate: () => {
    const token = safeGetItem('pos_token');
    const userStr = safeGetItem('pos_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true, hydrated: true });
        return;
      } catch {
        safeRemoveItem('pos_token');
        safeRemoveItem('pos_user');
      }
    }
    set({ hydrated: true });
  },
}));

export type { User };
