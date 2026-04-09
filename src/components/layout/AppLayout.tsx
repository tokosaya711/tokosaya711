'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Calculator,
  Cake,
  UtensilsCrossed,
  FolderTree,
  Users,
  Receipt,
  Package,
  Shield,
  ShieldX,
  Settings,
  LogOut,
  Menu,
  AlertTriangle,
  BarChart3,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { useAppStore, type PageKey } from '@/lib/app-store';
import { useAuthStore } from '@/lib/auth-store';
import { useFeatureStore, mergeFeaturesWithDefaults, DEFAULT_PERMISSIONS } from '@/lib/feature-store';
import { toImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

// ── Legacy exports for backward compatibility ────────────────────
export function setGlobalFeatures(features: Record<string, Record<string, boolean>>) {
  useFeatureStore.getState().setFeatures(features);
}

export function getGlobalFeatures(): Record<string, Record<string, boolean>> {
  return useFeatureStore.getState().features;
}

export function hasFeature(featureKey: string, roleKey: string): boolean {
  return useFeatureStore.getState().hasFeature(featureKey, roleKey);
}

export function subscribeToFeatures(listener: () => void) {
  const unsub = useFeatureStore.subscribe(listener);
  return unsub;
}

// ── Menu items with feature keys ──────────────────────────────────
interface MenuItem {
  key: PageKey;
  label: string;
  icon: React.ReactNode;
  featureKey: string; // maps to FEATURES key in UsersPage
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-5" />, featureKey: 'dashboard' },
  { key: 'pos', label: 'POS / Kasir', icon: <Calculator className="size-5" />, featureKey: 'pos' },
  { key: 'cakes', label: 'Daftar Kue', icon: <Cake className="size-5" />, featureKey: 'cakes' },
  { key: 'foods', label: 'Daftar Makanan', icon: <UtensilsCrossed className="size-5" />, featureKey: 'foods' },
  { key: 'sembako', label: 'Daftar Sembako', icon: <ShoppingBag className="size-5" />, featureKey: 'sembako' },
  { key: 'categories', label: 'Kategori', icon: <FolderTree className="size-5" />, featureKey: 'categories' },
  { key: 'customers', label: 'Customer', icon: <Users className="size-5" />, featureKey: 'customers' },
  { key: 'transactions', label: 'Riwayat Penjualan', icon: <Receipt className="size-5" />, featureKey: 'transactions' },
  { key: 'stock', label: 'Manajemen Stok', icon: <Package className="size-5" />, featureKey: 'stock' },
  { key: 'laporan', label: 'Laporan', icon: <BarChart3 className="size-5" />, featureKey: 'laporan' },
  {
    key: 'pengguna',
    label: 'Administrasi',
    icon: <ClipboardList className="size-5" />,
    featureKey: 'pengguna',
    children: [
      { key: 'pengguna', label: 'Pengguna', icon: <Users className="size-4" />, featureKey: 'pengguna' },
      { key: 'users', label: 'Hak Akses', icon: <Shield className="size-4" />, featureKey: 'permissions' },
      { key: 'settings', label: 'Pengaturan', icon: <Settings className="size-4" />, featureKey: 'settings' },
    ],
  },
];

const pageTitles: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  pos: 'POS / Kasir',
  cakes: 'Daftar Kue',
  foods: 'Daftar Makanan',
  sembako: 'Daftar Sembako',
  categories: 'Kategori',
  customers: 'Customer',
  transactions: 'Riwayat Penjualan',
  stock: 'Manajemen Stok',
  laporan: 'Laporan',
  users: 'Hak Akses',
  pengguna: 'Pengguna',
  settings: 'Pengaturan',
};

// ── Map PageKey → featureKey for page-level access control ──
const pageFeatureMap: Record<string, string> = {};
for (const item of menuItems) {
  pageFeatureMap[item.key] = item.featureKey;
  if (item.children) {
    for (const child of item.children) {
      pageFeatureMap[child.key] = child.featureKey;
    }
  }
}

function NavContent({
  currentPage,
  onNavigate,
}: {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
}) {
  const { user } = useAuthStore();
  const features = useFeatureStore((s) => s.features);
  const loaded = useFeatureStore((s) => s.loaded);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    // Auto-expand Administrasi if current page is one of its children
    const childPages = new Set(['pengguna', 'users', 'settings']);
    return childPages;
  });

  const toggleMenu = (key: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleItems = useMemo(() => {
    if (!user) return [];
    // During loading, show all items to prevent flash/empty menu
    if (!loaded) return menuItems;
    const role = user.role;
    return menuItems
      .map((item) => {
        if (role === 'admin') return item;
        // Special case: categories is visible if user has ANY product type access
        if (item.key === 'categories') {
          const hasAnyType = (features['cakes']?.[role] ?? false) || (features['foods']?.[role] ?? false) || (features['sembako']?.[role] ?? false);
          return hasAnyType ? item : null;
        }
        const parentAllowed = features[item.featureKey]?.[role] ?? false;
        if (!parentAllowed && !item.children) return null;
        // For items with children, filter children by permission
        if (item.children && item.children.length > 0) {
          const visibleChildren = item.children.filter((child) => {
            if (role === 'admin') return true;
            return features[child.featureKey]?.[role] ?? false;
          });
          if (visibleChildren.length === 0 && !parentAllowed) return null;
          return { ...item, children: visibleChildren };
        }
        return parentAllowed ? item : null;
      })
      .filter(Boolean) as MenuItem[];
  }, [user, features, loaded]);

  // If user has no visible items after loading, show at least dashboard
  const displayItems = visibleItems.length > 0 ? visibleItems : menuItems.filter(m => !m.children).slice(0, 1);

  return (
    <nav className="flex-1 overflow-y-auto p-2 space-y-1">
      {displayItems.map((item) => {
        const isActive = currentPage === item.key;
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedMenus.has(item.key);
        const isChildActive = hasChildren && item.children!.some((c) => currentPage === c.key);

        if (hasChildren) {
          return (
            <div key={item.key}>
              <button
                onClick={() => toggleMenu(item.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isChildActive
                    ? '[background-color:var(--sidebar-active-bg,#dbeafe)] [color:var(--sidebar-active-text,#1e3a8a)]'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              {isExpanded && item.children && item.children.length > 0 && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map((child) => {
                    const childActive = currentPage === child.key;
                    return (
                      <button
                        key={child.key}
                        onClick={() => onNavigate(child.key)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          childActive
                            ? '[background-color:var(--sidebar-active-bg,#dbeafe)] [color:var(--sidebar-active-text,#1e3a8a)]'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {child.icon}
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? '[background-color:var(--sidebar-active-bg,#dbeafe)] [color:var(--sidebar-active-text,#1e3a8a)]'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  user: 'User',
  owner: 'Pemilik',
  cashier: 'Kasir',
};

function SidebarUser() {
  const { user, logout, token } = useAuthStore();
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const demoDaysLeft = useMemo(() => {
    if (!user?.isDemo || !user?.demoExpiresAt) return null;
    const now = new Date();
    const expires = new Date(user.demoExpiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [user]);

  return (
    <div className="p-4 border-t">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-blue-100 text-blue-800 text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate">{user?.name || 'User'}</p>
            {user?.isDemo && (
              <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[9px] px-1 py-0 leading-none">
                Demo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">
              {roleLabels[user?.role || ''] || user?.role || 'Unknown'}
            </p>
            {demoDaysLeft !== null && (
              <p className="text-[10px] text-violet-500">
                &middot; {demoDaysLeft} hari lagi
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            // Call logout API to clear session (for single-device login)
            if (token) {
              try {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                });
              } catch { /* ignore */ }
            }
            logout();
          }}
          className="size-8 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main App Layout ──────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentPage, setCurrentPage } = useAppStore();
  const { user, logout, token } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(30);
  const [logoutWarningSeconds, setLogoutWarningSeconds] = useState(20);
  const [storeLogo, setStoreLogo] = useState('');
  const [storeName, setStoreName] = useState('');
  const DEFAULT_LOGO = '/api/files/logos/default-store-logo.png';
  const displayLogo = storeLogo || DEFAULT_LOGO;

  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageTitle = pageTitles[currentPage] || 'Dashboard';

  // ── Page-level access gate ──
  const features = useFeatureStore((s) => s.features);
  const featuresLoaded = useFeatureStore((s) => s.loaded);
  const canAccessPage = useMemo(() => {
    if (!user) return true; // Not logged in yet
    if (!featuresLoaded) return true; // During loading, allow all
    if (user.role === 'admin') return true; // Admin has full access
    const featureKey = pageFeatureMap[currentPage];
    if (!featureKey) return true; // No feature key = always accessible (shouldn't happen)
    return features[featureKey]?.[user.role] ?? false;
  }, [user, features, featuresLoaded, currentPage]);

  const handleNavigate = (page: PageKey) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  // ── Initialize saved color theme ──
  useEffect(() => {
    const saved = localStorage.getItem('app-theme-color');
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      const colorPresets = [
        { primary: 'oklch(0.55 0.18 250)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.15 250)', sidebarPrimary: 'oklch(0.55 0.18 250)', sidebarActiveBg: '#dbeafe', sidebarActiveText: '#1e3a8a', accentLight: 'oklch(0.55 0.18 250 / 0.12)', accentMedium: 'oklch(0.55 0.18 250 / 0.20)', accentDark: 'oklch(0.40 0.18 250)', gradientFrom: 'oklch(0.55 0.18 250)', gradientTo: 'oklch(0.60 0.18 50)' },
        { primary: 'oklch(0.58 0.17 10)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.68 0.13 10)', sidebarPrimary: 'oklch(0.58 0.17 10)', sidebarActiveBg: '#ffe4e6', sidebarActiveText: '#881337', accentLight: 'oklch(0.58 0.17 10 / 0.12)', accentMedium: 'oklch(0.58 0.17 10 / 0.20)', accentDark: 'oklch(0.42 0.17 10)', gradientFrom: 'oklch(0.58 0.17 10)', gradientTo: 'oklch(0.60 0.17 350)' },
        { primary: 'oklch(0.55 0.16 160)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.13 160)', sidebarPrimary: 'oklch(0.55 0.16 160)', sidebarActiveBg: '#d1fae5', sidebarActiveText: '#064e3b', accentLight: 'oklch(0.55 0.16 160 / 0.12)', accentMedium: 'oklch(0.55 0.16 160 / 0.20)', accentDark: 'oklch(0.40 0.16 160)', gradientFrom: 'oklch(0.55 0.16 160)', gradientTo: 'oklch(0.60 0.16 200)' },
        { primary: 'oklch(0.65 0.15 75)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.75 0.12 75)', sidebarPrimary: 'oklch(0.65 0.15 75)', sidebarActiveBg: '#fef3c7', sidebarActiveText: '#78350f', accentLight: 'oklch(0.65 0.15 75 / 0.12)', accentMedium: 'oklch(0.65 0.15 75 / 0.20)', accentDark: 'oklch(0.50 0.15 75)', gradientFrom: 'oklch(0.65 0.15 75)', gradientTo: 'oklch(0.60 0.18 50)' },
        { primary: 'oklch(0.55 0.20 290)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.16 290)', sidebarPrimary: 'oklch(0.55 0.20 290)', sidebarActiveBg: '#ede9fe', sidebarActiveText: '#4c1d95', accentLight: 'oklch(0.55 0.20 290 / 0.12)', accentMedium: 'oklch(0.55 0.20 290 / 0.20)', accentDark: 'oklch(0.40 0.20 290)', gradientFrom: 'oklch(0.55 0.20 290)', gradientTo: 'oklch(0.60 0.17 350)' },
        { primary: 'oklch(0.55 0.12 200)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.10 200)', sidebarPrimary: 'oklch(0.55 0.12 200)', sidebarActiveBg: '#cffafe', sidebarActiveText: '#155e75', accentLight: 'oklch(0.55 0.12 200 / 0.12)', accentMedium: 'oklch(0.55 0.12 200 / 0.20)', accentDark: 'oklch(0.40 0.12 200)', gradientFrom: 'oklch(0.55 0.12 200)', gradientTo: 'oklch(0.60 0.18 50)' },
        { primary: 'oklch(0.60 0.18 50)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.70 0.14 50)', sidebarPrimary: 'oklch(0.60 0.18 50)', sidebarActiveBg: '#ffedd5', sidebarActiveText: '#7c2d12', accentLight: 'oklch(0.60 0.18 50 / 0.12)', accentMedium: 'oklch(0.60 0.18 50 / 0.20)', accentDark: 'oklch(0.45 0.18 50)', gradientFrom: 'oklch(0.60 0.18 50)', gradientTo: 'oklch(0.55 0.20 25)' },
        { primary: 'oklch(0.60 0.17 350)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.70 0.13 350)', sidebarPrimary: 'oklch(0.60 0.17 350)', sidebarActiveBg: '#fce7f3', sidebarActiveText: '#831843', accentLight: 'oklch(0.60 0.17 350 / 0.12)', accentMedium: 'oklch(0.60 0.17 350 / 0.20)', accentDark: 'oklch(0.45 0.17 350)', gradientFrom: 'oklch(0.60 0.17 350)', gradientTo: 'oklch(0.65 0.15 10)' },
        { primary: 'oklch(0.78 0.16 85)', foreground: 'oklch(0.28 0.06 85)', ringVal: 'oklch(0.83 0.12 85)', sidebarPrimary: 'oklch(0.78 0.16 85)', sidebarActiveBg: '#fef9c3', sidebarActiveText: '#713f12', accentLight: 'oklch(0.78 0.16 85 / 0.12)', accentMedium: 'oklch(0.78 0.16 85 / 0.20)', accentDark: 'oklch(0.60 0.16 85)', gradientFrom: 'oklch(0.78 0.16 85)', gradientTo: 'oklch(0.70 0.15 75)' },
        { primary: 'oklch(0.97 0.005 250)', foreground: 'oklch(0.25 0.01 250)', ringVal: 'oklch(0.82 0.005 250)', sidebarPrimary: 'oklch(0.25 0.01 250)', sidebarActiveBg: '#f3f4f6', sidebarActiveText: '#111827', accentLight: 'oklch(0.25 0.005 250 / 0.06)', accentMedium: 'oklch(0.25 0.005 250 / 0.10)', accentDark: 'oklch(0.20 0.01 250)', gradientFrom: 'oklch(0.97 0.005 250)', gradientTo: 'oklch(0.80 0.10 200)' },
      ];
      if (idx >= 0 && idx < colorPresets.length) {
        const preset = colorPresets[idx];
        const root = document.documentElement;
        root.style.setProperty('--primary', preset.primary);
        root.style.setProperty('--primary-foreground', preset.foreground);
        root.style.setProperty('--ring', preset.ringVal);
        root.style.setProperty('--sidebar-primary', preset.sidebarPrimary);
        root.style.setProperty('--sidebar-primary-foreground', preset.foreground);
        root.style.setProperty('--sidebar-active-bg', preset.sidebarActiveBg);
        root.style.setProperty('--sidebar-active-text', preset.sidebarActiveText);
        // App accent system
        root.style.setProperty('--app-accent', preset.primary);
        root.style.setProperty('--app-accent-foreground', preset.foreground);
        root.style.setProperty('--app-accent-light', preset.accentLight);
        root.style.setProperty('--app-accent-medium', preset.accentMedium);
        root.style.setProperty('--app-accent-dark', preset.accentDark);
        root.style.setProperty('--app-accent-ring', preset.ringVal);
        root.style.setProperty('--app-accent-gradient-from', preset.gradientFrom);
        root.style.setProperty('--app-accent-gradient-to', preset.gradientTo);
      }
    }
  }, []);

  // ── Fetch settings for auto-logout + features ──
  // Also refreshes user data from DB to pick up role/permission changes
  const settingsLoadedForUserId = useRef<string | null>(null);
  useEffect(() => {
    async function loadSettings() {
      const currentUserId = useAuthStore.getState().user?.id || '';
      if (settingsLoadedForUserId.current === currentUserId) return;
      settingsLoadedForUserId.current = currentUserId;

      try {
        const token = useAuthStore.getState().token;
        if (!token) return;

        // Refresh user data from DB (role might have been changed by admin)
        try {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            const currentUser = useAuthStore.getState().user;
            // Only update if role or isDemo changed (avoid unnecessary re-renders)
            if (currentUser && (currentUser.role !== meData.role || currentUser.isDemo !== meData.isDemo)) {
              useAuthStore.getState().login(token, {
                id: meData.id,
                name: meData.name,
                email: meData.email,
                role: meData.role,
                isDemo: meData.isDemo,
                demoExpiresAt: meData.demoExpiresAt,
              });
            }
          } else if (meRes.status === 401) {
            // Token is invalid or user no longer exists — force logout
            useAuthStore.getState().logout();
            return;
          }
        } catch {
          // Continue with existing auth data
        }

        const res = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAutoLogoutMinutes(data.autoLogoutMinutes ?? 30);
          setLogoutWarningSeconds(data.logoutWarningSeconds ?? 20);
          setStoreLogo(data.storeLogo || '');
          if (data.storeName) setStoreName(data.storeName);

          // Load feature permissions — merge with defaults
          try {
            const parsed = JSON.parse(data.features || '{}') as Record<string, Record<string, boolean>>;
            const parsedRoles = JSON.parse(data.customRoles || '[]') as Array<{ key: string }>;
            // Collect all role keys from defaults + custom roles + current user role
            const currentUserRole = useAuthStore.getState().user?.role || '';
            const allRoleKeys = Array.from(new Set([
              ...Object.keys(DEFAULT_PERMISSIONS['dashboard'] || {}),
              ...parsedRoles.map((r) => r.key),
              ...(currentUserRole ? [currentUserRole] : []),
            ]));
            const merged = mergeFeaturesWithDefaults(parsed, allRoleKeys);
            useFeatureStore.getState().setFeatures(merged);
          } catch {
            useFeatureStore.getState().setFeatures(DEFAULT_PERMISSIONS);
          }
        }
      } catch { /* use default */ }
    }
    if (user) loadSettings();
    else {
      // User logged out — reset so next login reloads settings
      settingsLoadedForUserId.current = null;
    }
  }, [user]);

  // ── Auto-logout timer ──
  const clearAllLogoutTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowLogoutWarning(false);
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllLogoutTimers();
    // Call logout API to clear session (for single-device login)
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    }
    logout();
  }, [clearAllLogoutTimers, logout, token]);

  const resetInactivityTimer = useCallback(() => {
    // If warning is showing, dismiss it and restart
    if (showLogoutWarning) {
      clearAllLogoutTimers();
    }
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (autoLogoutMinutes <= 0) return; // Disabled

    const totalMs = autoLogoutMinutes * 60 * 1000;
    const warningMs = Math.max(0, logoutWarningSeconds) * 1000;

    // Set the actual logout timer
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, totalMs);

    // Set warning timer (shows popup before logout)
    if (warningMs > 0 && totalMs > warningMs) {
      warningTimerRef.current = setTimeout(() => {
        setShowLogoutWarning(true);
        setCountdown(logoutWarningSeconds);
        // Start countdown
        countdownRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              handleLogout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, totalMs - warningMs);
    }
  }, [autoLogoutMinutes, logoutWarningSeconds, showLogoutWarning, handleLogout, clearAllLogoutTimers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) resetInactivityTimer();
    return () => {
      clearAllLogoutTimers();
    };
  }, [user, resetInactivityTimer, clearAllLogoutTimers]);

  return (
    <div className="flex h-screen overflow-hidden" onMouseMove={resetInactivityTimer} onKeyDown={resetInactivityTimer} onClick={resetInactivityTimer}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[250px] bg-card border-r flex-shrink-0 flex-col">
        {/* Logo/Brand */}
        <div className="p-4 pb-5 border-b flex flex-col items-center">
          <img
            src={toImageUrl(displayLogo)}
            alt="Logo"
            className="size-[105px] rounded-2xl object-cover shadow-lg"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              if (storeLogo) {
                // If custom logo failed, try default
                el.src = DEFAULT_LOGO;
              } else {
                el.style.display = 'none';
              }
            }}
          />
          {storeName && (
            <div className="mt-3 text-center">
              <h1 className="text-[26px] font-bold leading-tight">{storeName}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Point of Sale</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <NavContent currentPage={currentPage} onNavigate={handleNavigate} />

        {/* User info */}
        <SidebarUser />
      </aside>

      {/* Main Content */}
      <main className={`flex flex-col flex-1 min-w-0 ${currentPage === 'pos' ? 'overflow-hidden' : 'overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950'}`}>
        {/* Top Header */}
        <header className="bg-card border-b px-3 sm:px-4 py-2.5 flex items-center gap-2 shrink-0 z-10">
          {/* Hamburger (mobile only) */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden size-9 shrink-0"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[282px] p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              {/* Logo/Brand */}
              <div className="p-4 pb-5 border-b flex flex-col items-center">
                <img
                  src={toImageUrl(displayLogo)}
                  alt="Logo"
                  className="size-[105px] rounded-2xl object-cover shadow-lg"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    if (storeLogo) {
                      el.src = DEFAULT_LOGO;
                    } else {
                      el.style.display = 'none';
                    }
                  }}
                />
                {storeName && (
                  <div className="mt-3 text-center">
                    <h1 className="text-[26px] font-bold leading-tight">{storeName}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Point of Sale</p>
                  </div>
                )}
              </div>
              <NavContent currentPage={currentPage} onNavigate={handleNavigate} />
              <SidebarUser />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0">
            {storeName && (
              <span className="hidden sm:inline text-sm font-bold text-primary truncate max-w-[160px] lg:max-w-none">
                {storeName}
              </span>
            )}
            <span className="sm:hidden text-sm font-bold text-primary truncate">
              {storeName || pageTitle}
            </span>
            <span className="hidden sm:inline text-base sm:text-lg font-semibold truncate">{pageTitle}</span>
          </div>

          <div className="ml-auto" />
        </header>

        {/* Page Content */}
        <div className={currentPage === 'pos' ? 'flex-1 min-h-0 flex flex-col' : 'p-3 sm:p-6'}>
          {canAccessPage ? (
            children
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center">
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <ShieldX className="size-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-neutral-900">Akses Ditolak</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Anda tidak memiliki izin untuk mengakses halaman ini. Silakan hubungi administrator.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════ AUTO-LOGOUT WARNING POPUP ═══════════════ */}
      {showLogoutWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center animate-in fade-in zoom-in duration-300">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="size-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">Sesi Akan Berakhir</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Anda tidak aktif. Sistem akan logout otomatis dalam:
            </p>
            {/* Countdown circle */}
            <div className="mx-auto mb-4 w-20 h-20 rounded-full border-4 border-amber-400 flex items-center justify-center relative">
              <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" className="opacity-30" />
                <circle
                  cx="40" cy="40" r="36"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(countdown / (logoutWarningSeconds || 20)) * 226.2} 226.2`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="text-2xl font-bold text-amber-600 tabular-nums">{countdown}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-5">detik</p>
            <Button
              onClick={() => {
                clearAllLogoutTimers();
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold h-11 rounded-xl transition-colors"
            >
              Tetap Aktif
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
