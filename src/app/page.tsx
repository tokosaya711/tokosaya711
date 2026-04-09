'use client';

import { useEffect, lazy, Suspense, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/app-store';
import { useAuthStore } from '@/lib/auth-store';
import LoginPage from '@/components/pages/LoginPage';
import AppLayout from '@/components/layout/AppLayout';
import DemoPopup from '@/components/DemoPopup';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load pages for better performance
const DashboardPage = lazy(() => import('@/components/pages/DashboardPage'));
const POSPage = lazy(() => import('@/components/pages/POSPage'));
const ProductsPage = lazy(() => import('@/components/pages/ProductsPage'));
const CategoriesPage = lazy(() => import('@/components/pages/CategoriesPage'));
const CustomersPage = lazy(() => import('@/components/pages/CustomersPage'));
const TransactionHistoryPage = lazy(() => import('@/components/pages/TransactionHistoryPage'));
const StockPage = lazy(() => import('@/components/pages/StockPage'));
const LaporanPage = lazy(() => import('@/components/pages/LaporanPage'));
const UsersPage = lazy(() => import('@/components/pages/UsersPage'));
const PenggunaPage = lazy(() => import('@/components/pages/PenggunaPage'));
const SettingsPage = lazy(() => import('@/components/pages/SettingsPage'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-muted-foreground">Memuat halaman...</p>
      </div>
    </div>
  );
}

function PageRouter() {
  const { currentPage } = useAppStore();

  switch (currentPage) {
    case 'dashboard':
      return (
        <Suspense fallback={<PageLoading />}>
          <DashboardPage />
        </Suspense>
      );
    case 'pos':
      return (
        <Suspense fallback={<PageLoading />}>
          <POSPage />
        </Suspense>
      );
    case 'cakes':
      return (
        <Suspense fallback={<PageLoading />}>
          <ProductsPage type="cake" />
        </Suspense>
      );
    case 'foods':
      return (
        <Suspense fallback={<PageLoading />}>
          <ProductsPage type="food" />
        </Suspense>
      );
    case 'sembako':
      return (
        <Suspense fallback={<PageLoading />}>
          <ProductsPage type="sembako" />
        </Suspense>
      );
    case 'categories':
      return (
        <Suspense fallback={<PageLoading />}>
          <CategoriesPage />
        </Suspense>
      );
    case 'customers':
      return (
        <Suspense fallback={<PageLoading />}>
          <CustomersPage />
        </Suspense>
      );
    case 'transactions':
      return (
        <Suspense fallback={<PageLoading />}>
          <TransactionHistoryPage />
        </Suspense>
      );
    case 'stock':
      return (
        <Suspense fallback={<PageLoading />}>
          <StockPage />
        </Suspense>
      );
    case 'laporan':
      return (
        <Suspense fallback={<PageLoading />}>
          <LaporanPage />
        </Suspense>
      );
    case 'users':
      return (
        <Suspense fallback={<PageLoading />}>
          <UsersPage />
        </Suspense>
      );
    case 'pengguna':
      return (
        <Suspense fallback={<PageLoading />}>
          <PenggunaPage />
        </Suspense>
      );
    case 'settings':
      return (
        <Suspense fallback={<PageLoading />}>
          <SettingsPage />
        </Suspense>
      );
    default:
      return (
        <Suspense fallback={<PageLoading />}>
          <DashboardPage />
        </Suspense>
      );
  }
}

export default function Home() {
  const { isAuthenticated, hydrated, user, token } = useAuthStore();
  const [showDemoPopup, setShowDemoPopup] = useState(false);

  // Hydrate auth state from localStorage on client mount
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  // Show demo popup for demo users after authentication
  useEffect(() => {
    if (isAuthenticated && user?.isDemo) {
      // Small delay to let the app layout render first
      const popupTimer = setTimeout(() => {
        setShowDemoPopup(true);
      }, 500);
      return () => clearTimeout(popupTimer);
    }
  }, [isAuthenticated, user?.isDemo]);

  // Redirect on login: only redirect to dashboard on initial authentication (not on user data refresh)
  const hasRedirectedOnLogin = useRef(false);
  useEffect(() => {
    if (isAuthenticated && user && !hasRedirectedOnLogin.current) {
      hasRedirectedOnLogin.current = true;
      useAppStore.getState().setCurrentPage('dashboard');
    }
    // Reset flag on logout so next login redirects again
    if (!isAuthenticated) {
      hasRedirectedOnLogin.current = false;
    }
  }, [isAuthenticated, user]);

  const handleCloseDemoPopup = useCallback(() => {
    setShowDemoPopup(false);
  }, []);

  // Wait until client-side hydration is complete
  // Show a loading screen instead of null to ensure SSR has visible content
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm text-gray-500 font-medium">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <AppLayout>
        <ErrorBoundary>
          <PageRouter />
        </ErrorBoundary>
      </AppLayout>
      {user?.isDemo && showDemoPopup && (
        <DemoPopup onClose={handleCloseDemoPopup} />
      )}
    </>
  );
}
