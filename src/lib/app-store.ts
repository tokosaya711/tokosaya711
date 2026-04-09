import { create } from 'zustand';

export type PageKey = 'dashboard' | 'pos' | 'cakes' | 'foods' | 'sembako' | 'categories' | 'customers' | 'transactions' | 'stock' | 'laporan' | 'users' | 'pengguna' | 'settings';

interface AppState {
  currentPage: PageKey;
  sidebarOpen: boolean;
  setCurrentPage: (page: PageKey) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: true,
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
