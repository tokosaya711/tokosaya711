'use client';

import { useFeatureStore } from '@/lib/feature-store';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Hook to check if the current user has a specific feature permission.
 * Admin always has access to everything.
 * Uses Zustand store for reactive permission checks.
 */
export function usePermission(featureKey: string): boolean {
  const role = useAuthStore((s) => s.user?.role || '');
  const features = useFeatureStore((s) => s.features);
  const loaded = useFeatureStore((s) => s.loaded);

  if (!loaded) return true; // Allow during loading to prevent flash
  if (role === 'admin') return true; // Admin always has access

  return features[featureKey]?.[role] ?? false;
}

/**
 * Hook that returns an object of multiple permission checks.
 * Useful when a page needs to check multiple permissions.
 */
export function usePermissions(featureKeys: string[]): Record<string, boolean> {
  const role = useAuthStore((s) => s.user?.role || '');
  const features = useFeatureStore((s) => s.features);
  const loaded = useFeatureStore((s) => s.loaded);

  const permissions: Record<string, boolean> = {};
  for (const key of featureKeys) {
    if (!loaded || role === 'admin') {
      permissions[key] = true;
    } else {
      permissions[key] = features[key]?.[role] ?? false;
    }
  }
  return permissions;
}
