import { db } from './db';
import { DEFAULT_PERMISSIONS } from './feature-store';
import type { FeaturePermissions } from './feature-store';

// ── In-memory cache to avoid DB queries on every API call ──
// Uses a Map keyed by ownerId for multi-user isolation
const featureCache = new Map<string, { features: FeaturePermissions; timestamp: number }>();
const CACHE_TTL = 10_000; // 10 seconds

function getCacheKey(ownerId?: string): string {
  return ownerId || '__global__';
}

function getCached(ownerId?: string): FeaturePermissions | null {
  const key = getCacheKey(ownerId);
  const entry = featureCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.features;
  }
  return null;
}

function setCache(ownerId: string | undefined, features: FeaturePermissions): void {
  const key = getCacheKey(ownerId);
  featureCache.set(key, { features, timestamp: Date.now() });
}

/**
 * Server-side feature permission check.
 * Reads the `features` JSON from StoreSettings and checks if a given role
 * has access to a specific feature key.
 *
 * Admin always returns true.
 *
 * Usage in API routes:
 *   import { checkFeatureAccess } from '@/lib/feature-check';
 *   const allowed = await checkFeatureAccess(user.role, 'product_add');
 *   if (!allowed) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
 */
export async function checkFeatureAccess(
  role: string,
  featureKey: string,
  ownerId?: string
): Promise<boolean> {
  // Admin always has access
  if (role === 'admin') return true;

  try {
    const features = await loadFeatures(ownerId);
    return features[featureKey]?.[role] ?? false;
  } catch (error) {
    console.error('[feature-check] Error checking access:', error);
    return false;
  }
}

/**
 * Get all feature permissions (merged with defaults).
 * Used when you need to check multiple features at once.
 *
 * IMPORTANT: Also scans the User table for any role values that exist
 * in actual user accounts but may not be in customRoles or defaults.
 * This ensures roles like "cashier" or "owner" that exist in the DB
 * but aren't defined in the permission matrix still get checked properly
 * (they default to false unless explicitly set).
 */
// Cache key for admin's shared settings
const ADMIN_SETTINGS_CACHE_KEY = '__admin_shared__';

/**
 * Resolve the ownerId to use for loading permission settings.
 * For admin users: use their own StoreSettings.
 * For non-admin users: find the first active admin user's StoreSettings.
 */
async function resolveSettingsOwnerId(ownerId?: string): Promise<string | undefined> {
  if (!ownerId) return undefined;
  try {
    const user = await db.user.findUnique({ where: { id: ownerId }, select: { role: true } });
    if (user && user.role === 'admin') return ownerId;
    // Non-admin: find the first active admin's settings
    const adminUser = await db.user.findFirst({ where: { role: 'admin', isActive: true }, select: { id: true } });
    return adminUser?.id || ownerId;
  } catch {
    return ownerId;
  }
}

export async function loadFeatures(ownerId?: string): Promise<FeaturePermissions> {
  // Check cache first — use admin shared cache key for non-admin users
  const cacheKey = ownerId ? ADMIN_SETTINGS_CACHE_KEY : getCacheKey(ownerId);
  const cached = featureCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.features;

  try {
    // Resolve to admin's StoreSettings for permission sharing
    const resolvedOwnerId = await resolveSettingsOwnerId(ownerId);
    const settings = resolvedOwnerId
      ? await db.storeSettings.findFirst({ where: { ownerId: resolvedOwnerId } })
      : await db.storeSettings.findFirst();
    if (!settings) {
      setCache(ownerId, DEFAULT_PERMISSIONS);
      return DEFAULT_PERMISSIONS;
    }

    const parsed: FeaturePermissions =
      typeof settings.features === 'string'
        ? JSON.parse(settings.features || '{}')
        : (settings.features as FeaturePermissions) || {};

    // ── Build the complete set of role keys ──
    const roleKeySet = new Set<string>(
      Object.keys(DEFAULT_PERMISSIONS['dashboard'] || {})
    );

    // Add roles from customRoles definition
    if (settings.customRoles) {
      const roles =
        typeof settings.customRoles === 'string'
          ? JSON.parse(settings.customRoles || '[]')
          : settings.customRoles;
      for (const r of roles) {
        if (r.key) roleKeySet.add(r.key);
      }
    }

    // Add roles that exist in the User table (e.g., "cashier", "owner")
    // so they don't silently get undefined/false
    try {
      const users = await db.user.findMany({
        select: { role: true },
        distinct: ['role'],
      });
      for (const u of users) {
        if (u.role) roleKeySet.add(u.role);
      }
    } catch {
      // If User table query fails, continue with existing role keys
    }

    const allRoleKeys = Array.from(roleKeySet);

    // ── Merge: DB values override defaults, new roles default to false ──
    const merged: FeaturePermissions = {};
    const featureKeySet = new Set([
      ...Object.keys(DEFAULT_PERMISSIONS),
      ...Object.keys(parsed),
    ]);

    for (const fKey of featureKeySet) {
      merged[fKey] = {};
      for (const rKey of allRoleKeys) {
        if (rKey === 'admin') {
          merged[fKey][rKey] = true;
        } else {
          // DB value takes priority, then default, then false
          const dbVal = parsed[fKey]?.[rKey];
          const defaultVal = DEFAULT_PERMISSIONS[fKey]?.[rKey];
          // Use explicit check: if DB has the value (even false), use it
          merged[fKey][rKey] = dbVal !== undefined ? dbVal : (defaultVal ?? false);
        }
      }
    }

    // Cache under admin shared key (all non-admin users share the same permissions)
    featureCache.set(cacheKey, { features: merged, timestamp: Date.now() });
    return merged;
  } catch (error) {
    console.error('[feature-check] Error loading features:', error);
    return DEFAULT_PERMISSIONS;
  }
}

/**
 * Invalidate the feature cache (call after settings update).
 * If ownerId is provided, only that user's cache is invalidated.
 * If not, all caches are invalidated.
 */
export function invalidateFeatureCache(ownerId?: string): void {
  // Always invalidate the admin shared cache since all users reference it
  featureCache.delete(ADMIN_SETTINGS_CACHE_KEY);
  if (ownerId) {
    featureCache.delete(getCacheKey(ownerId));
  } else {
    featureCache.clear();
  }
}
