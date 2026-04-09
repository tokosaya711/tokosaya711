'use client';

import { useState, useEffect, useRef } from 'react';
import { compressImage } from '@/lib/image-compress';
import { toImageUrl } from '@/lib/utils';
import {
  Save,
  Store,
  Percent,
  Receipt,
  ShieldCheck,
  Camera,
  ImageIcon,
  X,
  Upload,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { usePermission } from '@/hooks/use-permission';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface StoreSettings {
  id: string;
  storeName: string;
  address: string;
  phone: string;
  storeLogo: string;
  taxRate: number;
  receiptFooter: string;
  demoPeriodDays: number;
  demoPopupMessage: string;
  autoLogoutMinutes: number;
  logoutWarningSeconds: number;
  singleDeviceLogin: boolean;
  features: Record<string, boolean> | null;
}

// ─── Mobile-safe file upload button (same pattern as ProductsPage) ───
function FileUploadButton({
  onFileSelect,
  accept,
  capture,
  children,
  className,
}: {
  onFileSelect: (file: File) => void;
  accept?: string;
  capture?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      e.target.value = ''; // reset so same file can be re-selected
    }
  };

  return (
    <label className={`relative inline-flex cursor-pointer ${className || ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/*'}
        capture={capture ? (capture as React.InputHTMLAttributes<HTMLInputElement>['capture']) : undefined}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ fontSize: '0px' }} // prevent iOS zoom on focus
      />
      <span className="pointer-events-none flex items-center justify-center gap-2 w-full">
        {children}
      </span>
    </label>
  );
}

export default function SettingsPage() {
  // ── Permission checks ──
  const canStore = usePermission('settings_store');
  const canTax = usePermission('settings_tax');
  const canReceipt = usePermission('settings_receipt');

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [receiptFooter, setReceiptFooter] = useState('');
  const [storeLogo, setStoreLogo] = useState('');

  // ── Color theme state ──
  const colorPresets = [
    { name: 'Biru', bg: 'bg-blue-500', ring: 'ring-blue-500', primary: 'oklch(0.55 0.18 250)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.15 250)', sidebarPrimary: 'oklch(0.55 0.18 250)', sidebarActiveBg: '#dbeafe', sidebarActiveText: '#1e3a8a', accentLight: 'oklch(0.55 0.18 250 / 0.12)', accentMedium: 'oklch(0.55 0.18 250 / 0.20)', accentDark: 'oklch(0.40 0.18 250)', gradientFrom: 'oklch(0.55 0.18 250)', gradientTo: 'oklch(0.60 0.18 50)' },
    { name: 'Rose', bg: 'bg-rose-500', ring: 'ring-rose-500', primary: 'oklch(0.58 0.17 10)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.68 0.13 10)', sidebarPrimary: 'oklch(0.58 0.17 10)', sidebarActiveBg: '#ffe4e6', sidebarActiveText: '#881337', accentLight: 'oklch(0.58 0.17 10 / 0.12)', accentMedium: 'oklch(0.58 0.17 10 / 0.20)', accentDark: 'oklch(0.42 0.17 10)', gradientFrom: 'oklch(0.58 0.17 10)', gradientTo: 'oklch(0.60 0.17 350)' },
    { name: 'Hijau', bg: 'bg-emerald-500', ring: 'ring-emerald-500', primary: 'oklch(0.55 0.16 160)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.13 160)', sidebarPrimary: 'oklch(0.55 0.16 160)', sidebarActiveBg: '#d1fae5', sidebarActiveText: '#064e3b', accentLight: 'oklch(0.55 0.16 160 / 0.12)', accentMedium: 'oklch(0.55 0.16 160 / 0.20)', accentDark: 'oklch(0.40 0.16 160)', gradientFrom: 'oklch(0.55 0.16 160)', gradientTo: 'oklch(0.60 0.16 200)' },
    { name: 'Amber', bg: 'bg-amber-500', ring: 'ring-amber-500', primary: 'oklch(0.65 0.15 75)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.75 0.12 75)', sidebarPrimary: 'oklch(0.65 0.15 75)', sidebarActiveBg: '#fef3c7', sidebarActiveText: '#78350f', accentLight: 'oklch(0.65 0.15 75 / 0.12)', accentMedium: 'oklch(0.65 0.15 75 / 0.20)', accentDark: 'oklch(0.50 0.15 75)', gradientFrom: 'oklch(0.65 0.15 75)', gradientTo: 'oklch(0.60 0.18 50)' },
    { name: 'Ungu', bg: 'bg-violet-500', ring: 'ring-violet-500', primary: 'oklch(0.55 0.20 290)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.16 290)', sidebarPrimary: 'oklch(0.55 0.20 290)', sidebarActiveBg: '#ede9fe', sidebarActiveText: '#4c1d95', accentLight: 'oklch(0.55 0.20 290 / 0.12)', accentMedium: 'oklch(0.55 0.20 290 / 0.20)', accentDark: 'oklch(0.40 0.20 290)', gradientFrom: 'oklch(0.55 0.20 290)', gradientTo: 'oklch(0.60 0.17 350)' },
    { name: 'Cyan', bg: 'bg-cyan-500', ring: 'ring-cyan-500', primary: 'oklch(0.55 0.12 200)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.65 0.10 200)', sidebarPrimary: 'oklch(0.55 0.12 200)', sidebarActiveBg: '#cffafe', sidebarActiveText: '#155e75', accentLight: 'oklch(0.55 0.12 200 / 0.12)', accentMedium: 'oklch(0.55 0.12 200 / 0.20)', accentDark: 'oklch(0.40 0.12 200)', gradientFrom: 'oklch(0.55 0.12 200)', gradientTo: 'oklch(0.60 0.18 50)' },
    { name: 'Orange', bg: 'bg-orange-500', ring: 'ring-orange-500', primary: 'oklch(0.60 0.18 50)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.70 0.14 50)', sidebarPrimary: 'oklch(0.60 0.18 50)', sidebarActiveBg: '#ffedd5', sidebarActiveText: '#7c2d12', accentLight: 'oklch(0.60 0.18 50 / 0.12)', accentMedium: 'oklch(0.60 0.18 50 / 0.20)', accentDark: 'oklch(0.45 0.18 50)', gradientFrom: 'oklch(0.60 0.18 50)', gradientTo: 'oklch(0.55 0.20 25)' },
    { name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500', primary: 'oklch(0.60 0.17 350)', foreground: 'oklch(0.98 0 0)', ringVal: 'oklch(0.70 0.13 350)', sidebarPrimary: 'oklch(0.60 0.17 350)', sidebarActiveBg: '#fce7f3', sidebarActiveText: '#831843', accentLight: 'oklch(0.60 0.17 350 / 0.12)', accentMedium: 'oklch(0.60 0.17 350 / 0.20)', accentDark: 'oklch(0.45 0.17 350)', gradientFrom: 'oklch(0.60 0.17 350)', gradientTo: 'oklch(0.65 0.15 10)' },
    { name: 'Kuning', bg: 'bg-yellow-400', ring: 'ring-yellow-400', primary: 'oklch(0.78 0.16 85)', foreground: 'oklch(0.28 0.06 85)', ringVal: 'oklch(0.83 0.12 85)', sidebarPrimary: 'oklch(0.78 0.16 85)', sidebarActiveBg: '#fef9c3', sidebarActiveText: '#713f12', accentLight: 'oklch(0.78 0.16 85 / 0.12)', accentMedium: 'oklch(0.78 0.16 85 / 0.20)', accentDark: 'oklch(0.60 0.16 85)', gradientFrom: 'oklch(0.78 0.16 85)', gradientTo: 'oklch(0.70 0.15 75)' },
    { name: 'Putih', bg: 'bg-white border border-gray-300', ring: 'ring-gray-400', primary: 'oklch(0.97 0.005 250)', foreground: 'oklch(0.25 0.01 250)', ringVal: 'oklch(0.82 0.005 250)', sidebarPrimary: 'oklch(0.25 0.01 250)', sidebarActiveBg: '#f3f4f6', sidebarActiveText: '#111827', accentLight: 'oklch(0.25 0.005 250 / 0.06)', accentMedium: 'oklch(0.25 0.005 250 / 0.10)', accentDark: 'oklch(0.20 0.01 250)', gradientFrom: 'oklch(0.97 0.005 250)', gradientTo: 'oklch(0.80 0.10 200)' },
  ];
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [colorApplied, setColorApplied] = useState(false);


  // ── Password change state ──
  const [ownOldPassword, setOwnOldPassword] = useState('');
  const [ownNewPassword, setOwnNewPassword] = useState('');
  const [ownConfirmPassword, setOwnConfirmPassword] = useState('');
  const [showOwnOldPassword, setShowOwnOldPassword] = useState(false);
  const [showOwnNewPassword, setShowOwnNewPassword] = useState(false);
  const [showOwnConfirmPassword, setShowOwnConfirmPassword] = useState(false);
  const [changingOwnPassword, setChangingOwnPassword] = useState(false);
  const [ownPasswordError, setOwnPasswordError] = useState('');
  const [ownPasswordSuccess, setOwnPasswordSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
    // Load saved color
    const saved = localStorage.getItem('app-theme-color');
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      if (idx >= 0 && idx < colorPresets.length) setSelectedColorIndex(idx);
    }
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal memuat pengaturan');
      const data: StoreSettings = await res.json();
      setSettings(data);
      setStoreName(data.storeName);
      setAddress(data.address);
      setPhone(data.phone);
      setTaxRate(data.taxRate);
      setReceiptFooter(data.receiptFooter);
      setStoreLogo(data.storeLogo || '');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoFileSelect = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError('Ukuran file maksimal 20MB.');
      return;
    }
    try {
      const compressedFile = await compressImage(file);
      const token = useAuthStore.getState().token;
      const uploadData = new FormData();
      uploadData.append('file', compressedFile);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      setStoreLogo(data.url);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengupload logo');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess(false);
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeName,
          address,
          phone,
          taxRate: Number(taxRate),
          receiptFooter,
          storeLogo,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan pengaturan');
      }
      const data: StoreSettings = await res.json();
      setSettings(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };


  const handleOwnChangePassword = async () => {
    setOwnPasswordError('');
    setOwnPasswordSuccess('');

    if (!ownOldPassword) {
      setOwnPasswordError('Password lama wajib diisi');
      return;
    }
    if (!ownNewPassword) {
      setOwnPasswordError('Password baru wajib diisi');
      return;
    }
    if (ownNewPassword.length < 6) {
      setOwnPasswordError('Password baru minimal 6 karakter');
      return;
    }
    if (ownNewPassword !== ownConfirmPassword) {
      setOwnPasswordError('Konfirmasi password tidak cocok');
      return;
    }

    try {
      setChangingOwnPassword(true);
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword: ownOldPassword, newPassword: ownNewPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengubah password');
      }
      setOwnPasswordSuccess('Password berhasil diubah!');
      setOwnOldPassword('');
      setOwnNewPassword('');
      setOwnConfirmPassword('');
      setTimeout(() => setOwnPasswordSuccess(''), 3000);
    } catch (err) {
      setOwnPasswordError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setChangingOwnPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    );
  }

  // Check if user has any settings permission
  const hasAnyPermission = canStore || canTax || canReceipt;

  if (!hasAnyPermission) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="size-8 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-neutral-900">Akses Ditolak</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Anda tidak memiliki izin untuk mengakses halaman pengaturan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pengaturan Toko</h1>
        <p className="text-muted-foreground">
          Kelola informasi toko, pajak, struk, dan ganti password
        </p>
      </div>

      {/* Rubah Warna */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            🎨 Rubah Warna Aplikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pilih warna tema utama aplikasi, lalu klik tombol "Rubah" untuk menerapkan.
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
            {colorPresets.map((item, idx) => (
              <button
                key={item.bg}
                type="button"
                onClick={() => {
                  setSelectedColorIndex(idx);
                  setColorApplied(false);
                }}
                className={`w-10 h-10 rounded-full ${item.bg} transition-all hover:scale-110 shadow-sm ${
                  selectedColorIndex === idx
                    ? `ring-2 ring-offset-2 ${item.ring}`
                    : 'opacity-60 hover:opacity-100'
                }`}
                title={item.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              Warna dipilih: <span className="text-muted-foreground font-normal">{colorPresets[selectedColorIndex].name}</span>
            </span>
            <Button
              onClick={() => {
                const preset = colorPresets[selectedColorIndex];
                const root = document.documentElement;
                // shadcn/ui CSS variables
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
                localStorage.setItem('app-theme-color', String(selectedColorIndex));
                setColorApplied(true);
                setTimeout(() => setColorApplied(false), 2000);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {colorApplied ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Tersimpan!
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Rubah
                </>
              )}
            </Button>
            {colorApplied && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="size-4" />
                Warna berhasil diterapkan!
              </span>
            )}
          </div>
          {/* Preview strip */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <div className={`w-full h-8 rounded-lg ${colorPresets[selectedColorIndex].bg}`} />
          </div>
        </CardContent>
      </Card>

      {/* Store Information */}
      {canStore && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="size-5 text-blue-600" />
            Informasi Toko
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Toko */}
          <div className="space-y-2">
            <Label>Logo Toko</Label>
            {storeLogo ? (
              <div className="space-y-2">
                <div className="relative group inline-block">
                  <img
                    src={toImageUrl(storeLogo)}
                    alt="Logo toko"
                    className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {canStore && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity rounded-lg">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 border-0 h-7 text-xs"
                        onClick={() => setStoreLogo('')}
                      >
                        <X className="h-3 w-3" />
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
                {canStore && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs text-muted-foreground">Ganti logo:</div>
                    <div className="flex gap-2">
                      <FileUploadButton
                        onFileSelect={handleLogoFileSelect}
                        className="flex-1 h-9 rounded-lg border-2 border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 active:bg-blue-100"
                      >
                        <Upload className="h-4 w-4" />
                        Pilih File
                      </FileUploadButton>
                      <FileUploadButton
                        onFileSelect={handleLogoFileSelect}
                        capture="environment"
                        className="flex-1 h-9 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 active:bg-emerald-100"
                      >
                        <Camera className="h-4 w-4" />
                        Kamera
                      </FileUploadButton>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              canStore && (
                <div className="flex flex-col gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 max-w-xs">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Upload logo toko:</span>
                  </div>
                  <div className="flex gap-2">
                    <FileUploadButton
                      onFileSelect={handleLogoFileSelect}
                      className="flex-1 h-10 rounded-lg border-2 border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 active:bg-blue-100"
                    >
                      <Upload className="h-4 w-4" />
                      Pilih File
                    </FileUploadButton>
                    <FileUploadButton
                      onFileSelect={handleLogoFileSelect}
                      capture="environment"
                      className="flex-1 h-10 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 active:bg-emerald-100"
                    >
                      <Camera className="h-4 w-4" />
                      Kamera
                    </FileUploadButton>
                  </div>
                </div>
              )
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP &middot; Maks 5MB</p>

          </div>
          <div className="space-y-2">
            <Label htmlFor="storeName">Nama Toko</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              disabled={!canStore}
              placeholder="Masukkan nama toko"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Alamat</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!canStore}
              placeholder="Masukkan alamat toko"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">No. Telepon</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canStore}
              placeholder="Masukkan nomor telepon"
            />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Tax Settings */}
      {canTax && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="size-5 text-emerald-600" />
            Pajak
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="taxRate">Tarif Pajak (%)</Label>
          <p className="text-sm text-muted-foreground">
            Persentase pajak yang dikenakan pada setiap transaksi
          </p>
          <Input
            id="taxRate"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={taxRate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setTaxRate(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
            }}
            disabled={!canTax}
            className="max-w-32"
          />
        </CardContent>
      </Card>
      )}

      {/* Receipt Settings */}
      {canReceipt && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-5 text-sky-600" />
            Struk
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="receiptFooter">Footer Struk</Label>
          <p className="text-sm text-muted-foreground">
            Pesan yang ditampilkan di bagian bawah struk
          </p>
          <Textarea
            id="receiptFooter"
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            disabled={!canReceipt}
            placeholder="Masukkan pesan footer struk"
            rows={3}
          />
        </CardContent>
      </Card>
      )}


      {/* Ganti Password */}
      {hasAnyPermission && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-5 text-blue-600" />
            Ganti Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="own-old-password">Password Lama</Label>
            <div className="relative">
              <Input
                id="own-old-password"
                type={showOwnOldPassword ? 'text' : 'password'}
                value={ownOldPassword}
                onChange={(e) => setOwnOldPassword(e.target.value)}
                placeholder="Masukkan password lama"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOwnOldPassword(!showOwnOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOwnOldPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="own-new-password">Password Baru</Label>
            <div className="relative">
              <Input
                id="own-new-password"
                type={showOwnNewPassword ? 'text' : 'password'}
                value={ownNewPassword}
                onChange={(e) => setOwnNewPassword(e.target.value)}
                placeholder="Masukkan password baru (min. 6 karakter)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOwnNewPassword(!showOwnNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOwnNewPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="own-confirm-password">Konfirmasi Password</Label>
            <div className="relative">
              <Input
                id="own-confirm-password"
                type={showOwnConfirmPassword ? 'text' : 'password'}
                value={ownConfirmPassword}
                onChange={(e) => setOwnConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOwnConfirmPassword(!showOwnConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOwnConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {ownPasswordError && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs dark:bg-red-950/50 dark:text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{ownPasswordError}</span>
            </div>
          )}
          {ownPasswordSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 text-emerald-600 text-xs dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>{ownPasswordSuccess}</span>
            </div>
          )}

          <Button
            onClick={handleOwnChangePassword}
            disabled={changingOwnPassword}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {changingOwnPassword ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Mengubah...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 size-4" />
                Ubah Password
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      )}

      <div className="flex items-center gap-4">
        {/* Save Button */}
        {(canStore || canTax || canReceipt) && (
          <>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-32"
            >
              {saving ? (
                <>
                  <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Simpan
                </>
              )}
            </Button>
            {success && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <ShieldCheck className="size-4" />
                Pengaturan berhasil disimpan!
              </span>
            )}
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
          </>
        )}
      </div>

    </div>
  );
}
