import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────
interface FeaturePermissions {
  [feature: string]: {
    [role: string]: boolean;
  };
}

interface FeatureState {
  features: FeaturePermissions;
  loaded: boolean;
  setFeatures: (features: FeaturePermissions) => void;
  resetFeatures: () => void;
  hasFeature: (featureKey: string, roleKey: string) => boolean;
}

// ── Default permissions (same as UsersPage defaults) ──
const DEFAULT_PERMISSIONS: FeaturePermissions = {
  // Dashboard
  dashboard: { admin: true, manager: true, user: true, demo: true },
  dashboard_stats: { admin: true, manager: true, user: true, demo: true },
  dashboard_best_seller: { admin: true, manager: true, user: true, demo: true },
  dashboard_recent_tx: { admin: true, manager: true, user: true, demo: true },
  // POS
  pos: { admin: true, manager: true, user: true, demo: true },
  pos_discount: { admin: true, manager: true, user: false, demo: false },
  pos_payment: { admin: true, manager: true, user: true, demo: true },
  pos_receipt: { admin: true, manager: true, user: true, demo: true },
  pos_refund: { admin: true, manager: false, user: false, demo: false },
  pos_hold: { admin: true, manager: true, user: true, demo: true },
  // Produk
  cakes: { admin: true, manager: true, user: true, demo: true },
  foods: { admin: true, manager: true, user: true, demo: true },
  sembako: { admin: true, manager: true, user: true, demo: true },
  category_add: { admin: true, manager: false, user: false, demo: true },
  categories_cake: { admin: true, manager: true, user: false, demo: true },
  category_add_cake: { admin: true, manager: false, user: false, demo: true },
  category_edit_cake: { admin: true, manager: true, user: false, demo: true },
  category_delete_cake: { admin: true, manager: false, user: false, demo: false },
  categories_food: { admin: true, manager: true, user: false, demo: true },
  category_add_food: { admin: true, manager: false, user: false, demo: true },
  category_edit_food: { admin: true, manager: true, user: false, demo: true },
  category_delete_food: { admin: true, manager: false, user: false, demo: false },
  categories_sembako: { admin: true, manager: true, user: false, demo: true },
  category_add_sembako: { admin: true, manager: false, user: false, demo: true },
  category_edit_sembako: { admin: true, manager: true, user: false, demo: true },
  category_delete_sembako: { admin: true, manager: false, user: false, demo: false },
  cake_add: { admin: true, manager: false, user: false, demo: true },
  food_add: { admin: true, manager: false, user: false, demo: true },
  sembako_add: { admin: true, manager: false, user: false, demo: true },
  cake_edit: { admin: true, manager: false, user: false, demo: true },
  food_edit: { admin: true, manager: false, user: false, demo: true },
  sembako_edit: { admin: true, manager: false, user: false, demo: true },
  cake_delete: { admin: true, manager: false, user: false, demo: false },
  food_delete: { admin: true, manager: false, user: false, demo: false },
  sembako_delete: { admin: true, manager: false, user: false, demo: false },
  cake_photo: { admin: true, manager: false, user: false, demo: true },
  food_photo: { admin: true, manager: false, user: false, demo: true },
  sembako_photo: { admin: true, manager: false, user: false, demo: true },
  product_price: { admin: true, manager: false, user: false, demo: true },
  // Customer
  customers: { admin: true, manager: true, user: true, demo: true },
  customer_add: { admin: true, manager: true, user: false, demo: true },
  customer_edit: { admin: true, manager: true, user: false, demo: true },
  customer_delete: { admin: true, manager: false, user: false, demo: false },
  customer_history: { admin: true, manager: true, user: true, demo: true },
  // Transaksi
  transactions: { admin: true, manager: true, user: false, demo: false },
  transaction_detail: { admin: true, manager: true, user: false, demo: false },
  transaction_filter: { admin: true, manager: true, user: false, demo: false },
  transaction_reprint: { admin: true, manager: true, user: false, demo: false },
  transaction_export: { admin: true, manager: false, user: false, demo: false },
  transaction_delete: { admin: true, manager: true, user: false, demo: false },
  transaction_edit: { admin: true, manager: true, user: false, demo: false },
  // Stok
  stock: { admin: true, manager: true, user: false, demo: false },
  stock_edit: { admin: true, manager: true, user: false, demo: false },
  stock_alert: { admin: true, manager: true, user: false, demo: false },
  stock_adjustment: { admin: true, manager: false, user: false, demo: false },
  stock_delete: { admin: true, manager: false, user: false, demo: false },
  // Pengguna
  pengguna: { admin: true, manager: true, user: false, demo: false },
  pengguna_pembeli: { admin: true, manager: true, user: false, demo: false },
  pengguna_delete: { admin: true, manager: false, user: false, demo: false },
  // Admin
  users: { admin: true, manager: false, user: false, demo: false },
  user_add: { admin: true, manager: false, user: false, demo: false },
  user_edit: { admin: true, manager: false, user: false, demo: false },
  user_delete: { admin: true, manager: false, user: false, demo: false },
  user_password: { admin: true, manager: false, user: false, demo: false },
  permissions: { admin: true, manager: false, user: false, demo: false },
  settings: { admin: true, manager: true, user: true, demo: true },
  settings_store: { admin: true, manager: true, user: true, demo: true },
  settings_tax: { admin: true, manager: true, user: true, demo: true },
  settings_receipt: { admin: true, manager: true, user: true, demo: true },
  settings_password: { admin: true, manager: true, user: true, demo: true },
  settings_color: { admin: true, manager: true, user: true, demo: true },
  settings_demo: { admin: true, manager: false, user: false, demo: false },
  settings_security: { admin: true, manager: false, user: false, demo: false },
  settings_logout_warning: { admin: true, manager: false, user: false, demo: false },
  // Laporan
  laporan: { admin: true, manager: true, user: true, demo: true },
  laporan_harian: { admin: true, manager: true, user: true, demo: true },
  laporan_bulanan: { admin: true, manager: false, user: false, demo: false },
  laporan_produk: { admin: true, manager: false, user: false, demo: false },
  laporan_keuangan: { admin: true, manager: false, user: false, demo: false },
};

// ── Zustand Store ─────────────────────────────────────
export const useFeatureStore = create<FeatureState>((set, get) => ({
  features: DEFAULT_PERMISSIONS,
  loaded: false,

  setFeatures: (features: FeaturePermissions) => {
    set({ features, loaded: true });
  },

  resetFeatures: () => {
    set({ features: DEFAULT_PERMISSIONS, loaded: false });
  },

  hasFeature: (featureKey: string, roleKey: string): boolean => {
    // Admin always has access
    if (roleKey === 'admin') return true;
    const { features } = get();
    return features[featureKey]?.[roleKey] ?? false;
  },
}));

// ── Utility: merge DB features with defaults ──────────
// This ensures that:
// 1. All features from the DB are preserved (admin's config)
// 2. New features/features not in DB get default values
// 3. New roles not in DB get false for all features
export function mergeFeaturesWithDefaults(
  dbFeatures: FeaturePermissions,
  allRoleKeys: string[]
): FeaturePermissions {
  const merged: FeaturePermissions = {};
  const allFeatureKeys = new Set([
    ...Object.keys(DEFAULT_PERMISSIONS),
    ...Object.keys(dbFeatures),
  ]);

  for (const featureKey of allFeatureKeys) {
    merged[featureKey] = {};
    for (const roleKey of allRoleKeys) {
      if (roleKey === 'admin') {
        // Admin always has access
        merged[featureKey][roleKey] = true;
      } else {
        const dbValue = dbFeatures[featureKey]?.[roleKey];
        const defaultValue = DEFAULT_PERMISSIONS[featureKey]?.[roleKey];
        merged[featureKey][roleKey] = dbValue ?? defaultValue ?? false;
      }
    }
  }

  return merged;
}

// ── Export defaults for reference ──────────────────────
export { DEFAULT_PERMISSIONS };
export type { FeaturePermissions };
