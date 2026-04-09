'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  Lock,
  Timer,
  Plus,
  Trash2,
  Pencil,
  X,
  MonitorSmartphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/auth-store';
import { setGlobalFeatures } from '@/components/layout/AppLayout';

// ── Types ──────────────────────────────────────────────
interface FeaturePermissions {
  [feature: string]: {
    [role: string]: boolean;
  };
}

interface RoleDef {
  key: string;
  label: string;
  color: string;
}

// ── Feature definitions ────────────────────────────────
const FEATURES = [
  // Dashboard
  { key: 'dashboard', label: 'Dashboard', icon: '📊', group: 'Dashboard' },
  { key: 'dashboard_stats', label: 'Lihat Statistik Penjualan', icon: '📈', group: 'Dashboard' },
  { key: 'dashboard_best_seller', label: 'Lihat Produk Terlaris', icon: '🏆', group: 'Dashboard' },
  { key: 'dashboard_recent_tx', label: 'Lihat Transaksi Terakhir', icon: '🕐', group: 'Dashboard' },
  // POS
  { key: 'pos', label: 'POS / Kasir', icon: '🧮', group: 'POS' },
  { key: 'pos_discount', label: 'Berikan Diskon', icon: '🏷️', group: 'POS' },
  { key: 'pos_payment', label: 'Pilih Metode Pembayaran', icon: '💳', group: 'POS' },
  { key: 'pos_receipt', label: 'Cetak Struk', icon: '🧾', group: 'POS' },
  { key: 'pos_refund', label: 'Proses Refund / Retur', icon: '↩️', group: 'POS' },
  { key: 'pos_hold', label: 'Simpan Sementara (Hold)', icon: '⏸️', group: 'POS' },
  // Manajemen Kue
  { key: 'cakes', label: 'Daftar Kue', icon: '🎂', group: 'Kue' },
  { key: 'cake_add', label: 'Tambah Kue', icon: '🎂', group: 'Kue' },
  { key: 'cake_edit', label: 'Edit Kue', icon: '✏️', group: 'Kue' },
  { key: 'cake_delete', label: 'Hapus Kue', icon: '🗑️', group: 'Kue' },
  { key: 'cake_photo', label: 'Upload Foto Kue', icon: '📷', group: 'Kue' },
  // Manajemen Makanan
  { key: 'foods', label: 'Daftar Makanan', icon: '🍽️', group: 'Makanan' },
  { key: 'food_add', label: 'Tambah Makanan', icon: '🍽️', group: 'Makanan' },
  { key: 'food_edit', label: 'Edit Makanan', icon: '✏️', group: 'Makanan' },
  { key: 'food_delete', label: 'Hapus Makanan', icon: '🗑️', group: 'Makanan' },
  { key: 'food_photo', label: 'Upload Foto Makanan', icon: '📷', group: 'Makanan' },
  // Manajemen Sembako
  { key: 'sembako', label: 'Daftar Sembako', icon: '🛒', group: 'Sembako' },
  { key: 'sembako_add', label: 'Tambah Sembako', icon: '🛒', group: 'Sembako' },
  { key: 'sembako_edit', label: 'Edit Sembako', icon: '✏️', group: 'Sembako' },
  { key: 'sembako_delete', label: 'Hapus Sembako', icon: '🗑️', group: 'Sembako' },
  { key: 'sembako_photo', label: 'Upload Foto Sembako', icon: '📷', group: 'Sembako' },
  // Produk (Lainnya)
  { key: 'product_price', label: 'Ubah Harga Produk', icon: '💲', group: 'Produk' },
  // Kategori Kue
  { key: 'categories_cake', label: 'Kategori Kue', icon: '📁', group: 'Kue' },
  { key: 'category_add_cake', label: 'Tambah Kategori Kue', icon: '➕', group: 'Kue' },
  { key: 'category_edit_cake', label: 'Edit Kategori Kue', icon: '✏️', group: 'Kue' },
  { key: 'category_delete_cake', label: 'Hapus Kategori Kue', icon: '🗑️', group: 'Kue' },
  // Kategori Makanan
  { key: 'categories_food', label: 'Kategori Makanan', icon: '📁', group: 'Makanan' },
  { key: 'category_add_food', label: 'Tambah Kategori Makanan', icon: '➕', group: 'Makanan' },
  { key: 'category_edit_food', label: 'Edit Kategori Makanan', icon: '✏️', group: 'Makanan' },
  { key: 'category_delete_food', label: 'Hapus Kategori Makanan', icon: '🗑️', group: 'Makanan' },
  // Kategori Sembako
  { key: 'categories_sembako', label: 'Kategori Sembako', icon: '📁', group: 'Sembako' },
  { key: 'category_add_sembako', label: 'Tambah Kategori Sembako', icon: '➕', group: 'Sembako' },
  { key: 'category_edit_sembako', label: 'Edit Kategori Sembako', icon: '✏️', group: 'Sembako' },
  { key: 'category_delete_sembako', label: 'Hapus Kategori Sembako', icon: '🗑️', group: 'Sembako' },
  // Customer
  { key: 'customers', label: 'Daftar Customer', icon: '👥', group: 'Customer' },
  { key: 'customer_add', label: 'Tambah Customer', icon: '👤', group: 'Customer' },
  { key: 'customer_edit', label: 'Edit Customer', icon: '📝', group: 'Customer' },
  { key: 'customer_delete', label: 'Hapus Customer', icon: '🚫', group: 'Customer' },
  { key: 'customer_history', label: 'Lihat Riwayat Belanja', icon: '📋', group: 'Customer' },
  // Transaksi
  { key: 'transactions', label: 'Riwayat Penjualan', icon: '📜', group: 'Transaksi' },
  { key: 'transaction_detail', label: 'Lihat Detail Transaksi', icon: '🔍', group: 'Transaksi' },
  { key: 'transaction_edit', label: 'Edit Transaksi', icon: '✏️', group: 'Transaksi' },
  { key: 'transaction_delete', label: 'Hapus Transaksi', icon: '🗑️', group: 'Transaksi' },
  { key: 'transaction_filter', label: 'Filter & Pencarian Transaksi', icon: '🔎', group: 'Transaksi' },
  { key: 'transaction_reprint', label: 'Cetak Ulang Struk', icon: '🖨️', group: 'Transaksi' },
  { key: 'transaction_export', label: 'Export Data Penjualan', icon: '📤', group: 'Transaksi' },
  // Stok
  { key: 'stock', label: 'Manajemen Stok', icon: '📦', group: 'Stok' },
  { key: 'stock_edit', label: 'Update Stok Produk', icon: '🔄', group: 'Stok' },
  { key: 'stock_alert', label: 'Peringatan Stok Rendah', icon: '⚠️', group: 'Stok' },
  { key: 'stock_adjustment', label: 'Penyesuaian Stok (Opname)', icon: '📊', group: 'Stok' },
  { key: 'stock_delete', label: 'Hapus Stok Produk', icon: '🗑️', group: 'Stok' },
  // Pengguna
  { key: 'pengguna', label: 'Halaman Pengguna', icon: '👥', group: 'Pengguna' },
  { key: 'pengguna_pembeli', label: 'Lihat Daftar Pembeli', icon: '🧑‍🤝‍🧑', group: 'Pengguna' },
  { key: 'pengguna_delete', label: 'Hapus Pembeli', icon: '🗑️', group: 'Pengguna' },
  // Admin
  { key: 'users', label: 'Kelola User', icon: '🛡️', group: 'Admin' },
  { key: 'user_add', label: 'Tambah User Baru', icon: '👤', group: 'Admin' },
  { key: 'user_edit', label: 'Edit User', icon: '✏️', group: 'Admin' },
  { key: 'user_delete', label: 'Hapus User', icon: '🚫', group: 'Admin' },
  { key: 'user_password', label: 'Ganti Password User', icon: '🔑', group: 'Admin' },
  { key: 'permissions', label: 'Kelola Hak Akses', icon: '🔐', group: 'Admin' },
  { key: 'settings', label: 'Pengaturan Toko', icon: '⚙️', group: 'Pengaturan' },
  { key: 'settings_store', label: 'Informasi Toko & Logo', icon: '🏪', group: 'Pengaturan' },
  { key: 'settings_tax', label: 'Pengaturan Pajak', icon: '💰', group: 'Pengaturan' },
  { key: 'settings_receipt', label: 'Pengaturan Struk', icon: '🧾', group: 'Pengaturan' },
  { key: 'settings_password', label: 'Ganti Password', icon: '🔑', group: 'Pengaturan' },
  { key: 'settings_color', label: 'Rubah Warna', icon: '🎨', group: 'Pengaturan' },
  { key: 'settings_demo', label: 'Pengaturan Akun Demo', icon: '⏰', group: 'Admin' },
  { key: 'settings_security', label: 'Pengaturan Keamanan', icon: '🔒', group: 'Admin' },
  { key: 'settings_logout_warning', label: 'Peringatan Logout Otomatis', icon: '⏱️', group: 'Admin' },
  { key: 'laporan', label: 'Laporan & Analitik', icon: '📈', group: 'Laporan' },
  { key: 'laporan_harian', label: 'Laporan Penjualan Harian', icon: '📅', group: 'Laporan' },
  { key: 'laporan_bulanan', label: 'Laporan Penjualan Bulanan', icon: '📆', group: 'Laporan' },
  { key: 'laporan_produk', label: 'Laporan Produk Terlaris', icon: '🏅', group: 'Laporan' },
  { key: 'laporan_keuangan', label: 'Laporan Keuangan', icon: '💵', group: 'Laporan' },
];

const FEATURE_GROUPS = [
  'Dashboard',
  'POS',
  'Kue',
  'Makanan',
  'Sembako',
  'Produk',
  'Customer',
  'Transaksi',
  'Stok',
  'Pengguna',
  'Pengaturan',
  'Admin',
  'Laporan',
] as const;

const DEFAULT_ROLES: RoleDef[] = [
  { key: 'admin', label: 'Admin', color: 'rose' },
  { key: 'manager', label: 'Manager', color: 'blue' },
  { key: 'user', label: 'User', color: 'emerald' },
  { key: 'demo', label: 'Demo', color: 'amber' },
];

const PROTECTED_ROLES = ['admin', 'demo'];

const DEFAULT_PERMISSIONS: FeaturePermissions = {};
for (const feature of FEATURES) {
  DEFAULT_PERMISSIONS[feature.key] = {
    admin: true,
    manager: false,
    user: false,
  };
}
// Override defaults (admin always true, demo gets same as user for compatibility)
const perms: Record<string, Record<string, boolean>> = {
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
  // Kategori per tipe
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
  transaction_edit: { admin: true, manager: false, user: false, demo: false },
  transaction_delete: { admin: true, manager: false, user: false, demo: false },
  transaction_filter: { admin: true, manager: true, user: false, demo: false },
  transaction_reprint: { admin: true, manager: true, user: false, demo: false },
  transaction_export: { admin: true, manager: false, user: false, demo: false },
  // Stok
  stock: { admin: true, manager: true, user: false, demo: false },
  stock_edit: { admin: true, manager: true, user: false, demo: false },
  stock_alert: { admin: true, manager: true, user: false, demo: false },
  stock_adjustment: { admin: true, manager: false, user: false, demo: false },
  stock_delete: { admin: true, manager: false, user: false, demo: false },
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
  // Pengguna
  pengguna: { admin: true, manager: true, user: false, demo: false },
  pengguna_pembeli: { admin: true, manager: true, user: false, demo: false },
  pengguna_delete: { admin: true, manager: false, user: false, demo: false },
};
for (const [key, val] of Object.entries(perms)) {
  DEFAULT_PERMISSIONS[key] = val;
}

const ROLE_COLORS = [
  { key: 'rose', label: 'Rose', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  { key: 'blue', label: 'Biru', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { key: 'emerald', label: 'Hijau', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { key: 'amber', label: 'Amber', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { key: 'violet', label: 'Violet', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { key: 'cyan', label: 'Cyan', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  { key: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { key: 'pink', label: 'Pink', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { key: 'teal', label: 'Teal', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
];

// ── Helpers ────────────────────────────────────────────
function getRoleBadgeClasses(colorKey: string): string {
  const c = ROLE_COLORS.find((r) => r.key === colorKey);
  if (!c) return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  return `${c.bg} ${c.text} ${c.border}`;
}

function toRoleKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ── Sub-permission helper ──────────────────────────────
// Determines which feature keys to use for view/edit/delete sub-permissions.
// If a dedicated _edit or _delete feature key exists, use it; otherwise fall back to the main key.
const ALL_FEATURE_KEYS = FEATURES.map((f) => f.key);

function getFeatureSubKeys(featureKey: string): { view: string; edit: string; delete: string } {
  return {
    view: featureKey,
    edit: ALL_FEATURE_KEYS.includes(featureKey + '_edit') ? featureKey + '_edit' : featureKey,
    delete: ALL_FEATURE_KEYS.includes(featureKey + '_delete') ? featureKey + '_delete' : featureKey,
  };
}

// Parent features: first feature in each group. Toggling parent cascades to all group members.
const GROUP_PARENTS = new Set<string>();
const groupFirstSeen: Record<string, string> = {};
for (const f of FEATURES) {
  if (!groupFirstSeen[f.group]) {
    groupFirstSeen[f.group] = f.key;
    GROUP_PARENTS.add(f.key);
  }
}

// ── Component ──────────────────────────────────────────
export default function UsersPage() {
  const { token, user } = useAuthStore();

  // ── Data state ──
  const [features, setFeatures] = useState<FeaturePermissions>(DEFAULT_PERMISSIONS);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [featureSaveStatus, setFeatureSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  // ── Roles state ──
  const [roles, setRoles] = useState<RoleDef[]>(DEFAULT_ROLES);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDef | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormColor, setRoleFormColor] = useState('amber');
  const [roleFormError, setRoleFormError] = useState('');
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleDef | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // ── Security settings state ──
  const [singleDeviceLogin, setSingleDeviceLogin] = useState(false);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(30);
  const [logoutWarningSeconds, setLogoutWarningSeconds] = useState(20);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);

  // ── Demo settings state ──
  const [demoPeriodDays, setDemoPeriodDays] = useState(7);
  const [demoPopupMessage, setDemoPopupMessage] = useState(
    'Selamat datang di Sweet Bakery & Food POS! Anda sedang menggunakan akun demo. Nikmati pengalaman mencoba semua fitur selama masa trial.'
  );
  const [savingDemo, setSavingDemo] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState('');
  const [demoError, setDemoError] = useState('');

  // ── Auth check ──
  const isAdmin = user?.role === 'admin';

  // ── API Helper ──
  const authHeaders = useMemo(
    () => ({
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  // ── Load features & roles ──
  const loadFeatures = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings', authHeaders);
      if (!res.ok) throw new Error('Gagal memuat pengaturan');
      const data = await res.json();

      // Load roles: all default roles first, then append custom roles from DB (excluding duplicates)
      const parsedRoles = JSON.parse(data.customRoles || '[]') as RoleDef[];
      if (parsedRoles.length > 0) {
        const customOnly = parsedRoles.filter(r => !DEFAULT_ROLES.some(d => d.key === r.key));
        setRoles([...DEFAULT_ROLES, ...customOnly]);
      } else {
        setRoles([...DEFAULT_ROLES]);
      }

      // Load features
      const parsed = JSON.parse(data.features || '{}');
      const merged: FeaturePermissions = {};
      const allRoleKeys = [...DEFAULT_ROLES, ...parsedRoles].map((r) => r.key);
      for (const feature of FEATURES) {
        merged[feature.key] = {};
        for (const roleKey of allRoleKeys) {
          const defaultVal = DEFAULT_PERMISSIONS[feature.key]?.[roleKey];
          merged[feature.key][roleKey] = parsed[feature.key]?.[roleKey] ?? defaultVal ?? false;
        }
      }
      setFeatures(merged);
      setFeaturesLoaded(true);
    } catch {
      setFeatures(DEFAULT_PERMISSIONS);
      setFeaturesLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [token, authHeaders]);

  const loadExtraSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAutoLogoutMinutes(data.autoLogoutMinutes ?? 30);
      setLogoutWarningSeconds(data.logoutWarningSeconds ?? 20);
      setSingleDeviceLogin(data.singleDeviceLogin ?? false);
      setDemoPeriodDays(data.demoPeriodDays ?? 7);
      setDemoPopupMessage(
        data.demoPopupMessage ??
          'Selamat datang di Sweet Bakery & Food POS! Anda sedang menggunakan akun demo. Nikmati pengalaman mencoba semua fitur selama masa trial.'
      );
    } catch {
      // Use defaults
    }
  }, [token]);

  useEffect(() => {
    loadFeatures();
    loadExtraSettings();
  }, [loadFeatures, loadExtraSettings]);

  // ── Role CRUD ──
  const openAddRoleDialog = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormColor('amber');
    setRoleFormError('');
    setShowRoleDialog(true);
  };

  const openEditRoleDialog = (role: RoleDef) => {
    setEditingRole(role);
    setRoleFormName(role.label);
    setRoleFormColor(role.color);
    setRoleFormError('');
    setShowRoleDialog(true);
  };

  const handleSaveRole = () => {
    const trimmed = roleFormName.trim();
    if (!trimmed) {
      setRoleFormError('Nama role wajib diisi');
      return;
    }

    if (editingRole) {
      // Edit existing role
      setRoles((prev) =>
        prev.map((r) => (r.key === editingRole.key ? { ...r, label: trimmed, color: roleFormColor } : r))
      );
    } else {
      // Add new role
      const key = toRoleKey(trimmed);
      if (roles.some((r) => r.key === key)) {
        setRoleFormError('Role sudah ada');
        return;
      }

      const newRole: RoleDef = { key, label: trimmed, color: roleFormColor };
      setRoles((prev) => [...prev, newRole]);

      // Initialize permissions for new role (all false)
      setFeatures((prev) => {
        const updated = { ...prev };
        for (const feature of FEATURES) {
          updated[feature.key] = {
            ...updated[feature.key],
            [key]: false,
          };
        }
        return updated;
      });
    }

    setShowRoleDialog(false);
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setIsDeletingRole(true);
    try {
      // Remove role from state
      setRoles((prev) => prev.filter((r) => r.key !== deleteRoleTarget.key));

      // Remove role permissions from features
      setFeatures((prev) => {
        const updated: FeaturePermissions = {};
        for (const feature of FEATURES) {
          const perms = { ...prev[feature.key] };
          delete perms[deleteRoleTarget.key];
          updated[feature.key] = perms;
        }
        return updated;
      });

      setDeleteRoleTarget(null);

      // Build updated features without the deleted role
      const updatedFeatures: FeaturePermissions = {};
      for (const feature of FEATURES) {
        const perms = { ...features[feature.key] };
        delete perms[deleteRoleTarget.key];
        updatedFeatures[feature.key] = perms;
      }

      // Auto-save both customRoles and features (cascade delete)
      const customRoles = roles.filter((r) => !PROTECTED_ROLES.includes(r.key)).filter((r) => r.key !== deleteRoleTarget.key);
      await fetch('/api/settings', {
        method: 'PUT',
        ...authHeaders,
        body: JSON.stringify({
          customRoles: JSON.stringify(customRoles),
          features: JSON.stringify(updatedFeatures),
        }),
      });

      // Reset original features snapshot
      originalFeaturesRef.current = JSON.stringify(updatedFeatures);
      // Update global permission store
      setGlobalFeatures(updatedFeatures);
    } catch {
      // Silently fail, state is already updated
    } finally {
      setIsDeletingRole(false);
    }
  };

  // ── Save security settings ──
  const handleSaveSecurity = async () => {
    try {
      setSavingSecurity(true);
      setSecurityError('');
      setSecuritySuccess('');
      const res = await fetch('/api/settings', {
        method: 'PUT',
        ...authHeaders,
        body: JSON.stringify({ autoLogoutMinutes: Number(autoLogoutMinutes), logoutWarningSeconds: Number(logoutWarningSeconds), singleDeviceLogin: Boolean(singleDeviceLogin) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan pengaturan keamanan');
      }
      setSecuritySuccess('Pengaturan keamanan berhasil disimpan!');
      setTimeout(() => setSecuritySuccess(''), 3000);
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSavingSecurity(false);
    }
  };

  // ── Save demo settings ──
  const handleSaveDemo = async () => {
    try {
      setSavingDemo(true);
      setDemoError('');
      setDemoSuccess('');
      const res = await fetch('/api/settings', {
        method: 'PUT',
        ...authHeaders,
        body: JSON.stringify({
          demoPeriodDays: Number(demoPeriodDays),
          demoPopupMessage,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan pengaturan demo');
      }
      setDemoSuccess('Pengaturan akun demo berhasil disimpan!');
      setTimeout(() => setDemoSuccess(''), 3000);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSavingDemo(false);
    }
  };

  // ── Toggle feature permission ──
  const handleToggleFeature = (featureKey: string, roleKey: string) => {
    const newValue = !features[featureKey]?.[roleKey];
    
    setFeatures((prev) => {
      const updated = { ...prev };
      // Always toggle the clicked feature
      updated[featureKey] = { ...updated[featureKey], [roleKey]: newValue };
      
      // If this is a parent feature, cascade to all features in the same group
      if (GROUP_PARENTS.has(featureKey)) {
        const group = FEATURES.find(f => f.key === featureKey)?.group;
        if (group) {
          for (const f of FEATURES) {
            if (f.group === group && f.key !== featureKey) {
              updated[f.key] = { ...updated[f.key], [roleKey]: newValue };
            }
          }
        }
      }
      
      return updated;
    });
    setFeatureSaveStatus('idle');
  };

  // ── Save features ──
  const handleSaveFeatures = async () => {
    try {
      setIsSavingFeatures(true);
      // Save features and custom roles together
      const customRoles = roles.filter((r) => !PROTECTED_ROLES.includes(r.key));
      const res = await fetch('/api/settings', {
        method: 'PUT',
        ...authHeaders,
        body: JSON.stringify({
          features: JSON.stringify(features),
          customRoles: JSON.stringify(customRoles),
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan pengaturan');
      // Update global permission store immediately so other pages react
      setGlobalFeatures(features);
      // Reset original snapshot to current state
      originalFeaturesRef.current = JSON.stringify(features);
      setFeatureSaveStatus('success');
      setTimeout(() => setFeatureSaveStatus('idle'), 3000);
    } catch {
      setFeatureSaveStatus('error');
      setTimeout(() => setFeatureSaveStatus('idle'), 3000);
    } finally {
      setIsSavingFeatures(false);
    }
  };

  // ── Feature save has unsaved changes ──
  const originalFeaturesRef = useRef<string>('');

  // Store original features snapshot only on first load
  useEffect(() => {
    if (featuresLoaded && !originalFeaturesRef.current) {
      originalFeaturesRef.current = JSON.stringify(features);
    }
  }, [featuresLoaded]);

  // Compute hasFeatureChanges from ref
  const hasFeatureChanges = useMemo(() => {
    if (!originalFeaturesRef.current) return false;
    return JSON.stringify(features) !== originalFeaturesRef.current;
  }, [features]);

  // ── Access denied ──
  if (!isAdmin && user) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="rounded-full bg-red-100 p-4">
              <ShieldX className="size-8 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-neutral-900">Akses Ditolak</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Halaman ini hanya dapat diakses oleh admin.
                Silakan hubungi administrator untuk mendapatkan akses.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Memuat pengaturan hak akses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* ═══════════════ Header ═══════════════ */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <div className="rounded-lg bg-blue-100 p-2">
              <Shield className="size-5 text-blue-700" />
            </div>
            Hak Akses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola hak akses, keamanan, dan akun demo
          </p>
        </div>

        {/* ═══════════════ Roles Management ═══════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ShieldCheck className="size-4 sm:size-5 text-blue-600" />
                Daftar Role
                <span className="text-sm font-normal text-muted-foreground">
                  ({roles.length} role)
                </span>
              </CardTitle>
              <Button
                onClick={openAddRoleDialog}
                className="bg-blue-500 hover:bg-blue-600 text-white gap-2 text-xs sm:text-sm active:scale-95 transition-transform"
                size="sm"
              >
                <Plus className="size-4" />
                Tambah Role
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <div
                  key={role.key}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <Badge
                    variant="secondary"
                    className={`text-xs ${getRoleBadgeClasses(role.color)}`}
                  >
                    {role.label}
                  </Badge>
                  {PROTECTED_ROLES.includes(role.key) ? (
                    <span className="text-[10px] text-muted-foreground">Bawaan</span>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEditRoleDialog(role)}
                        title="Edit Role"
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteRoleTarget(role)}
                        title="Hapus Role"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════ Feature Toggle Matrix ═══════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Shield className="size-4 sm:size-5 text-blue-600" />
                Matriks Hak Akses Fitur
              </CardTitle>
              <Button
                onClick={handleSaveFeatures}
                disabled={isSavingFeatures || !hasFeatureChanges}
                className="bg-blue-500 hover:bg-blue-600 text-white gap-2 text-xs sm:text-sm active:scale-95 transition-transform"
                size="sm"
              >
                {isSavingFeatures ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {isSavingFeatures ? 'Menyimpan...' : 'Simpan Akses'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Unified table — sticky first column on mobile */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <th className="sticky left-0 z-10 bg-neutral-50/95 px-4 py-3 text-left text-sm font-medium text-muted-foreground w-[220px] backdrop-blur-sm">Fitur</th>
                    {roles.map((role) => (
                      <th key={role.key} className="px-1 py-3 text-center text-[10px] font-medium text-muted-foreground min-w-[80px]">
                        <Badge variant="secondary" className={`text-xs ${getRoleBadgeClasses(role.color)}`}>
                          {role.label}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_GROUPS.map((group) => (
                    <React.Fragment key={group}>
                      <tr className="bg-blue-50/60 hover:bg-blue-50/60">
                        <td colSpan={roles.length + 1} className="sticky left-0 z-10 bg-blue-50/95 px-4 py-2 backdrop-blur-sm">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">{group}</span>
                        </td>
                      </tr>
                      {FEATURES.filter((f) => f.group === group).map((feature) => (
                          <tr key={feature.key} className="border-t border-border/50">
                            <td className="sticky left-0 z-10 bg-background px-4 py-2.5 backdrop-blur-sm">
                              <span className="text-sm font-medium whitespace-nowrap">{feature.label}</span>
                            </td>
                            {roles.map((role) => {
                              const isAdminLocked = role.key === 'admin';
                              const isChecked = features[feature.key]?.[role.key] ?? false;
                              return (
                                <td key={role.key} className="text-center px-1 py-1.5">
                                  <div className="flex justify-center">
                                    <button
                                      type="button"
                                      onClick={() => !isAdminLocked && handleToggleFeature(feature.key, role.key)}
                                      disabled={isAdminLocked}
                                      className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150 ${
                                        isChecked
                                          ? 'bg-emerald-500 border border-emerald-600'
                                          : 'bg-white border border-neutral-300'
                                      } ${isAdminLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-80 active:scale-90'}`}
                                      title={`${feature.label} — ${role.label}`}
                                    >
                                      {isChecked && (
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save status */}
            {featureSaveStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 border-t">
                <ShieldCheck className="size-4 shrink-0" />
                Pengaturan hak akses berhasil disimpan
              </div>
            )}
            {featureSaveStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border-t">
                <AlertCircle className="size-4 shrink-0" />
                Gagal menyimpan pengaturan hak akses
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════ Akun Demo ═══════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="size-5 text-violet-600" />
              Akun Demo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demoPeriodDays">Masa Aktif Demo (hari)</Label>
              <Input
                id="demoPeriodDays"
                type="number"
                inputMode="numeric"
                min={0}
                value={demoPeriodDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDemoPeriodDays(isNaN(val) || val < 0 ? 0 : val);
                }}
                className="max-w-32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demoPopupMessage">Pesan Popup Demo</Label>
              <Textarea
                id="demoPopupMessage"
                value={demoPopupMessage}
                onChange={(e) => setDemoPopupMessage(e.target.value)}
                placeholder="Pesan yang ditampilkan saat user demo login"
                rows={3}
              />
            </div>
            {demoError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{demoError}</span>
              </div>
            )}
            {demoSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 text-emerald-600 text-xs">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>{demoSuccess}</span>
              </div>
            )}
            <Button
              onClick={handleSaveDemo}
              disabled={savingDemo}
              className="bg-blue-500 hover:bg-blue-600 text-white gap-2 active:scale-95 transition-transform"
              size="sm"
            >
              {savingDemo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {savingDemo ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </CardContent>
        </Card>

        {/* ═══════════════ Keamanan ═══════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-5 text-rose-600" />
              Keamanan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Single Device Login - with edit button */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1 flex-1 mr-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MonitorSmartphone className="size-4 text-rose-500" />
                  Akun Hanya Bisa Digunakan 1 Perangkat
                </Label>
                <p className="text-xs text-muted-foreground">
                  Jika diaktifkan, setiap akun hanya bisa login di satu perangkat saja.
                  Jika ada yang login dari perangkat lain, akan muncul peringatan &quot;akun sudah digunakan silahkan logout di perangkat yang lain&quot;.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className={`flex h-8 w-12 items-center justify-center rounded-full text-xs font-bold ${singleDeviceLogin ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                  {singleDeviceLogin ? 'AKTIF' : 'OFF'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecurityDialog(true)}
                  className="active:scale-95 transition-transform text-xs"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
            </div>

            {/* Quick info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <Timer className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Auto Logout</p>
                  <p className="text-sm font-semibold">{autoLogoutMinutes > 0 ? `${autoLogoutMinutes} menit` : 'Nonaktif'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <AlertCircle className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Peringatan Logout</p>
                  <p className="text-sm font-semibold">{logoutWarningSeconds > 0 ? `${logoutWarningSeconds} detik` : 'Tanpa peringatan'}</p>
                </div>
              </div>
            </div>

            {securitySuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 text-emerald-600 text-xs">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>{securitySuccess}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════ ADD/EDIT ROLE DIALOG ═══════════════ */}
      <Dialog
        open={showRoleDialog}
        onOpenChange={(open) => { if (!open) setShowRoleDialog(false); }}
      >
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRole ? (
                <><Pencil className="size-5 text-blue-600" /> Edit Role</>
              ) : (
                <><Plus className="size-5 text-blue-600" /> Tambah Role Baru</>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Perbarui nama dan warna role.'
                : 'Buat role baru untuk mengatur hak akses pengguna.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">
                Nama Role <span className="text-red-500">*</span>
              </Label>
              <Input
                id="role-name"
                placeholder="Contoh: Supervisor, Gudang, Kasir"
                value={roleFormName}
                onChange={(e) => { setRoleFormName(e.target.value); setRoleFormError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRole(); }}
              />
            </div>

            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_COLORS.map((color) => (
                  <button
                    key={color.key}
                    type="button"
                    onClick={() => setRoleFormColor(color.key)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      roleFormColor === color.key
                        ? 'border-neutral-900 scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    title={color.label}
                  >
                    <div className={`w-full h-full rounded-full ${color.bg}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-50 border">
                <Badge variant="secondary" className={`text-xs ${getRoleBadgeClasses(roleFormColor)}`}>
                  {roleFormName || 'Nama Role'}
                </Badge>
                {!editingRole && roleFormName && (
                  <span className="text-xs text-muted-foreground">
                    Key: {toRoleKey(roleFormName)}
                  </span>
                )}
              </div>
            </div>

            {roleFormError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{roleFormError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSaveRole}
              className="bg-blue-500 hover:bg-blue-600 text-white active:scale-95 transition-transform"
            >
              {editingRole ? 'Simpan' : 'Tambah Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DELETE ROLE CONFIRMATION ═══════════════ */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={(open) => { if (!open) setDeleteRoleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus role{' '}
              <span className="font-semibold">{deleteRoleTarget?.label}</span>?
              Hak akses untuk role ini akan dihapus. Pengguna dengan role ini tidak akan
              kehilangan akun, namun hak aksesnya akan mengikuti default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              onClick={handleDeleteRole}
              disabled={isDeletingRole}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeletingRole ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Hapus Role'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════ SECURITY SETTINGS DIALOG ═══════════════ */}
      <Dialog open={showSecurityDialog} onOpenChange={(open) => { if (!open) setShowSecurityDialog(false); }}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-5 text-rose-600" />
              Pengaturan Keamanan
            </DialogTitle>
            <DialogDescription>
              Atur keamanan akun dan sesi pengguna
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Single Device Login */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1 flex-1 mr-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MonitorSmartphone className="size-4 text-rose-500" />
                  Akun Hanya Bisa Digunakan 1 Perangkat
                </Label>
                <p className="text-xs text-muted-foreground">
                  Setiap akun hanya bisa login di satu perangkat. Login dari perangkat lain akan ditolak.
                </p>
              </div>
              <Switch
                checked={singleDeviceLogin}
                onCheckedChange={setSingleDeviceLogin}
              />
            </div>

            {/* Auto Logout */}
            <div className="space-y-2">
              <Label htmlFor="sec-autoLogoutMinutes">Auto Logout (menit)</Label>
              <p className="text-xs text-muted-foreground">
                Logout otomatis jika pengguna tidak aktif (0 = nonaktif)
              </p>
              <Input
                id="sec-autoLogoutMinutes"
                type="number"
                inputMode="numeric"
                min={0}
                value={autoLogoutMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setAutoLogoutMinutes(isNaN(val) || val < 0 ? 0 : val);
                }}
              />
            </div>

            {/* Logout Warning */}
            <div className="space-y-2">
              <Label htmlFor="sec-logoutWarningSeconds">Peringatan Logout (detik)</Label>
              <p className="text-xs text-muted-foreground">
                Tampilkan popup hitung mundur sebelum logout otomatis (0 = tanpa peringatan)
              </p>
              <Input
                id="sec-logoutWarningSeconds"
                type="number"
                inputMode="numeric"
                min={0}
                value={logoutWarningSeconds}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setLogoutWarningSeconds(isNaN(val) || val < 0 ? 0 : val);
                }}
              />
            </div>

            {securityError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{securityError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowSecurityDialog(false)}
              className="active:scale-95 transition-transform"
            >
              Batal
            </Button>
            <Button
              onClick={async () => {
                try {
                  setSavingSecurity(true);
                  setSecurityError('');
                  const res = await fetch('/api/settings', {
                    method: 'PUT',
                    ...authHeaders,
                    body: JSON.stringify({
                      autoLogoutMinutes: Number(autoLogoutMinutes),
                      logoutWarningSeconds: Number(logoutWarningSeconds),
                      singleDeviceLogin: Boolean(singleDeviceLogin),
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Gagal menyimpan');
                  }
                  setSecuritySuccess('Pengaturan keamanan berhasil disimpan!');
                  setTimeout(() => setSecuritySuccess(''), 3000);
                  setShowSecurityDialog(false);
                } catch (err) {
                  setSecurityError(err instanceof Error ? err.message : 'Gagal menyimpan');
                } finally {
                  setSavingSecurity(false);
                }
              }}
              disabled={savingSecurity}
              className="bg-blue-500 hover:bg-blue-600 text-white gap-2 active:scale-95 transition-transform"
            >
              {savingSecurity ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {savingSecurity ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
