'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, UserCog, Plus, Pencil, Trash2, Loader2, AlertCircle, Shield,
  ShieldCheck, KeyRound, UserCheck, UserX, Sparkles, Search, CalendarClock,
  Mail, Lock, Eye, EyeOff, Phone, User, Cake,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/lib/auth-store';
import { usePermission } from '@/hooks/use-permission';

// ── Types ──────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  isDemo: boolean;
  isPembeli: boolean;
  demoExpiresAt: string | null;
  roles: string;
  createdAt: string;
  _count?: { transactions: number };
}

interface UserForm {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
}

interface RoleOption {
  key: string;
  label: string;
}

interface ChangePasswordForm {
  userId: string;
  userName: string;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ── Helpers ────────────────────────────────────────────
function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'manager':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'cashier':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'demo':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'user':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  }
}

function getRoleAvatarColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-rose-500';
    case 'manager':
      return 'bg-blue-500';
    case 'cashier':
      return 'bg-amber-500';
    case 'demo':
      return 'bg-sky-500';
    case 'user':
      return 'bg-emerald-500';
    default:
      return 'bg-neutral-500';
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin': return 'Admin';
    case 'manager': return 'Manager';
    case 'cashier': return 'Kasir';
    case 'demo': return 'Demo';
    case 'owner': return 'Pemilik';
    default: return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

const DEFAULT_ROLE_OPTIONS: RoleOption[] = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'user', label: 'User' },
  { key: 'demo', label: 'Demo' },
];

const emptyForm: UserForm = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'admin',
  isActive: true,
};

const emptyPasswordForm: ChangePasswordForm = {
  userId: '',
  userName: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

// ── Component ──────────────────────────────────────────
export default function PenggunaPage() {
  const { token, user } = useAuthStore();

  // ── Data state ──
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── UI state ──
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState<ChangePasswordForm>(emptyPasswordForm);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPassError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // ── Add Pembeli dialog state ──
  const [showAddPembeliDialog, setShowAddPembeliDialog] = useState(false);
  const [pembeliForm, setPembeliForm] = useState({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPembeliPassword, setShowPembeliPassword] = useState(false);
  const [showPembeliConfirmPassword, setShowPembeliConfirmPassword] = useState(false);
  const [isSubmittingPembeli, setIsSubmittingPembeli] = useState(false);
  const [pembeliSubmitError, setPembeliSubmitError] = useState('');

  // ── Delete dialog state ──
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Pembeli search ──
  const [pembeliSearch, setPembeliSearch] = useState('');

  // ── Add Customer Pembeli dialog state ──
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [showCustomerConfirmPassword, setShowCustomerConfirmPassword] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [customerSubmitError, setCustomerSubmitError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // ── Multi-role edit state for pembeli ──
  const [editRoles, setEditRoles] = useState<string[]>([]);

  // ── Available roles from Hak Akses ──
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>(DEFAULT_ROLE_OPTIONS);



  // ── Auth check ──
  const isAdmin = user?.role === 'admin';

  // ── Permission checks ──
  const canViewPembeli = usePermission('pengguna_pembeli');
  const canDeletePembeli = usePermission('pengguna_delete');
  const canAddPembeli = usePermission('user_add');
  const canResetPassword = usePermission('user_password');

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

  // ── Load users ──
  const loadUsers = useCallback(async (silent = false) => {
    if (!token) {
      if (!silent) setIsLoading(false);
      return;
    }
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch('/api/users', authHeaders);
      if (res.status === 403) {
        setLoadError('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.');
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Gagal memuat data user');
      }
      const data = await res.json();
      setUsers(data);
      setLoadError('');
    } catch (err) {
      if (!silent) setLoadError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  }, [token, authHeaders]);

  // ── Load available roles from settings ──
  const loadAvailableRoles = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings', authHeaders);
      if (!res.ok) return;
      const data = await res.json();
      const parsedRoles = JSON.parse(data.customRoles || '[]') as RoleOption[];
      if (parsedRoles.length > 0) {
        // Merge defaults + custom, deduplicate by key (defaults take priority)
        const seen = new Set<string>();
        const deduped: RoleOption[] = [];
        for (const r of [...DEFAULT_ROLE_OPTIONS, ...parsedRoles]) {
          if (!seen.has(r.key)) {
            seen.add(r.key);
            deduped.push(r);
          }
        }
        setAvailableRoles(deduped);
      } else {
        setAvailableRoles(DEFAULT_ROLE_OPTIONS);
      }
    } catch {
      // keep defaults
    }
  }, [token, authHeaders]);

  useEffect(() => {
    loadUsers();
    loadAvailableRoles();
  }, [loadUsers, loadAvailableRoles]);

  // ── Form handlers ──
  const openAddDialog = () => {
    setForm(emptyForm);
    setSubmitError('');
    setShowAddDialog(true);
  };

  const openAddPembeliDialog = () => {
    setPembeliForm({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
    setPembeliSubmitError('');
    setShowPembeliPassword(false);
    setShowPembeliConfirmPassword(false);
    setShowAddPembeliDialog(true);
  };

  const openAddCustomerDialog = () => {
    setCustomerForm({ name: '', username: '', email: '', phone: '', password: '', confirmPassword: '' });
    setCustomerSubmitError('');
    setShowCustomerPassword(false);
    setShowCustomerConfirmPassword(false);
    setShowAddCustomerDialog(true);
  };

  const handleAddCustomer = async () => {
    if (!customerForm.name.trim() || !customerForm.email.trim()) {
      setCustomerSubmitError('Nama dan email wajib diisi');
      return;
    }
    if (!customerForm.username.trim()) {
      setCustomerSubmitError('Username wajib diisi');
      return;
    }
    if (!customerForm.password) {
      setCustomerSubmitError('Password wajib diisi');
      return;
    }
    if (customerForm.password.length < 6) {
      setCustomerSubmitError('Password minimal 6 karakter');
      return;
    }
    if (customerForm.password !== customerForm.confirmPassword) {
      setCustomerSubmitError('Password dan konfirmasi password tidak cocok');
      return;
    }

    setIsSubmittingCustomer(true);
    setCustomerSubmitError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        ...authHeaders,
        body: JSON.stringify({
          name: customerForm.name.trim(),
          username: customerForm.username.trim(),
          email: customerForm.email.trim(),
          phone: customerForm.phone.trim() || undefined,
          password: customerForm.password,
          role: 'user',
          isDemo: false,
          isPembeli: true,
          roles: 'user',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menambah pembeli');
      }
      setShowAddCustomerDialog(false);
      loadUsers(true);
    } catch (err) {
      setCustomerSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleAddPembeli = async () => {
    if (!pembeliForm.name.trim() || !pembeliForm.email.trim()) {
      setPembeliSubmitError('Nama dan email wajib diisi');
      return;
    }
    if (!pembeliForm.username.trim()) {
      setPembeliSubmitError('Username wajib diisi');
      return;
    }
    if (!pembeliForm.password) {
      setPembeliSubmitError('Password wajib diisi');
      return;
    }
    if (pembeliForm.password.length < 6) {
      setPembeliSubmitError('Password minimal 6 karakter');
      return;
    }
    if (pembeliForm.password !== pembeliForm.confirmPassword) {
      setPembeliSubmitError('Password dan konfirmasi password tidak cocok');
      return;
    }

    setIsSubmittingPembeli(true);
    setPembeliSubmitError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        ...authHeaders,
        body: JSON.stringify({
          name: pembeliForm.name.trim(),
          username: pembeliForm.username.trim(),
          email: pembeliForm.email.trim(),
          phone: pembeliForm.phone.trim() || undefined,
          password: pembeliForm.password,
          role: 'demo',
          isDemo: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menambah akun demo');
      }
      setShowAddPembeliDialog(false);
      loadUsers(true);
    } catch (err) {
      setPembeliSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmittingPembeli(false);
    }
  };

  const openEditDialog = (u: User) => {
    setForm({
      name: u.name,
      username: u.username || '',
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive,
    });
    setEditExpiryDate(u.isDemo ? (u.demoExpiresAt ? u.demoExpiresAt.split('T')[0] : '') : '');
    // Parse multi-roles for pembeli users
    if (u.isPembeli && u.roles) {
      const parsedRoles = u.roles.split(',').map(r => r.trim()).filter(Boolean);
      setEditRoles(parsedRoles.length > 0 ? parsedRoles : [u.role]);
    } else if (u.isPembeli) {
      setEditRoles([u.role]);
    } else {
      setEditRoles([]);
    }
    setEditingUser(u);
    setSubmitError('');
  };

  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editExpiryDate, setEditExpiryDate] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setSubmitError('Nama dan email wajib diisi');
      return;
    }

    if (!form.username.trim()) {
      setSubmitError('Username wajib diisi');
      return;
    }

    if (!editingUser && !form.password) {
      setSubmitError('Password wajib diisi untuk user baru');
      return;
    }

    // Validate pembeli has at least 1 role
    if (editingUser && editingUser.isPembeli && editRoles.length === 0) {
      setSubmitError('Pilih minimal 1 role untuk pembeli');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        role: form.role,
      };

      if (editingUser) {
        body.isActive = form.isActive;
        if (form.password) body.password = form.password;
        // Pembeli (demo) user: if role changed away from 'demo', move to pembeli
        if (editingUser.isDemo) {
          body.demoExpiresAt = editExpiryDate || null;
          if (form.role !== 'demo') {
            body.isDemo = false;
            body.isPembeli = true;
            body.demoExpiresAt = null;
            body.roles = form.role;
          }
        }
        // Pembeli user: always keep in pembeli, support multi-role
        if (editingUser.isPembeli) {
          body.isPembeli = true;
          body.role = editRoles.length > 0 ? editRoles[0] : form.role;
          body.roles = editRoles.join(',');
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          ...authHeaders,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal mengupdate user');
        }
      } else {
        body.password = form.password;

        const res = await fetch('/api/users', {
          method: 'POST',
          ...authHeaders,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menambah user');
        }
      }

      setShowAddDialog(false);
      setEditingUser(null);
      loadUsers(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
        ...authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menonaktifkan user');
      }
      setDeleteTarget(null);
      loadUsers(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menonaktifkan user');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Change password for other user (dialog) ──
  const openPasswordDialog = (u: User) => {
    setPasswordForm({
      userId: u.id,
      userName: u.name,
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPassError('');
    setPasswordSuccess('');
    setPasswordDialog(true);
  };

  const handleChangePassword = async () => {
    // Admin reset: no old password needed, just new password + confirm
    if (!passwordForm.newPassword) {
      setPassError('Password baru wajib diisi');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPassError('Password baru minimal 6 karakter');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPassError('Konfirmasi password tidak cocok');
      return;
    }

    setIsChangingPassword(true);
    setPassError('');
    setPasswordSuccess('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        ...authHeaders,
        body: JSON.stringify({
          newPassword: passwordForm.newPassword,
          targetUserId: passwordForm.userId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mereset password');
      }
      setPasswordSuccess(`Password user "${passwordForm.userName}" berhasil direset!`);
      setTimeout(() => {
        setPasswordDialog(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Gagal mereset password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ── Format expiry date ──
  const formatExpiryDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── Check if expired ──
  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  // ── Computed lists ──
  const adminUsers = useMemo(() => users.filter((u) => !u.isDemo && !u.isPembeli && (u.role === 'admin' || u.role === 'manager')), [users]);
  const demoUsers = useMemo(() => users.filter((u) => u.isDemo), [users]);
  const customerUsers = useMemo(() => users.filter((u) => u.isPembeli && !u.isDemo), [users]);
  const filteredDemo = useMemo(() => {
    if (!pembeliSearch.trim()) return demoUsers;
    const q = pembeliSearch.toLowerCase();
    return demoUsers.filter(
      (u) => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [demoUsers, pembeliSearch]);
  const filteredCustomer = useMemo(() => {
    if (!customerSearch.trim()) return customerUsers;
    const q = customerSearch.toLowerCase();
    return customerUsers.filter(
      (u) => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [customerUsers, customerSearch]);

  const stats = useMemo(() => ({
    total: adminUsers.length,
    active: adminUsers.filter((u) => u.isActive).length,
    inactive: adminUsers.filter((u) => !u.isActive).length,
    demo: demoUsers.length,
    pembeli: customerUsers.length,
  }), [adminUsers, demoUsers, customerUsers]);

  // ── Loading state ──
  if (isLoading && users.length === 0 && !loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* ═══════════════ Header ═══════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <Users className="size-5 text-blue-700" />
              </div>
              Pengguna
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola pengguna, daftar demo, dan daftar pembeli
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openAddDialog} className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
              <Plus className="size-4" />
              Tambah User
            </Button>
          )}
        </div>

        {/* ═══════════════ Admin-only sections (User/Admin on top) ═══════════════ */}
        {isAdmin && (
          <>
            {/* ═══════════════ Stats Cards ═══════════════ */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-5">
              <Card>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2.5 shrink-0">
                    <Users className="size-4 sm:size-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-neutral-900">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total User</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2.5 shrink-0">
                    <UserCheck className="size-4 sm:size-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-700">{stats.active}</p>
                    <p className="text-xs text-muted-foreground">Aktif</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2.5 shrink-0">
                    <UserX className="size-4 sm:size-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">{stats.inactive}</p>
                    <p className="text-xs text-muted-foreground">Nonaktif</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-sky-100 p-2.5 shrink-0">
                    <Sparkles className="size-4 sm:size-5 text-sky-700" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-sky-700">{stats.demo}</p>
                    <p className="text-xs text-muted-foreground">Demo</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-teal-100 p-2.5 shrink-0">
                    <User className="size-4 sm:size-5 text-teal-700" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-2xl font-bold text-teal-700">{stats.pembeli}</p>
                    <p className="text-xs text-muted-foreground">Pembeli</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ═══════════════ Error state ═══════════════ */}
            {loadError && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertCircle className="size-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{loadError}</p>
                  <Button variant="outline" size="sm" onClick={() => loadUsers()} className="ml-auto shrink-0">
                    Coba Lagi
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ═══════════════ Daftar User / Admin Table ═══════════════ */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <UserCog className="size-4 sm:size-5 text-blue-600" />
                    Daftar User / Admin
                    <span className="text-sm font-normal text-muted-foreground">
                      ({adminUsers.length} user)
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                        <TableHead className="w-[160px]">Nama</TableHead>
                        <TableHead className="w-[130px]">Username</TableHead>
                        <TableHead className="w-[80px]">Role</TableHead>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead className="text-right w-[140px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <UserCog className="size-10 opacity-30" />
                              <p className="text-sm font-medium">Belum ada user</p>
                              <p className="text-xs">
                                Klik tombol &quot;Tambah User&quot; untuk menambah data baru
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        adminUsers.map((u) => (
                          <TableRow key={u.id} className="group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getRoleAvatarColor(u.role)}`}
                                >
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{u.name}</p>
                                  {user?.id === u.id && (
                                    <p className="text-[10px] text-blue-600 font-medium">
                                      (Anda)
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground truncate">{u.username || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0 ${getRoleBadgeClasses(u.role)}`}
                                >
                                  {getRoleLabel(u.role)}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${
                                  u.isActive
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-red-100 text-red-700 border-red-200'
                                }`}
                              >
                                <span
                                  className={`size-1.5 rounded-full inline-block ${
                                    u.isActive ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                />
                                {u.isActive ? 'Aktif' : 'Nonaktif'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:bg-neutral-100"
                                  onClick={() => openEditDialog(u)}
                                  title="Edit"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                {isAdmin && user?.id !== u.id && canResetPassword && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:bg-neutral-100"
                                  onClick={() => openPasswordDialog(u)}
                                  title="Reset Password"
                                >
                                  <KeyRound className="size-4" />
                                </Button>
                                )}
                                {user?.id !== u.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    title="Nonaktifkan"
                                    onClick={() => setDeleteTarget(u)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══════════════ Daftar Demo ═══════════════ */}
        {canViewPembeli && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <UserCog className="size-4 sm:size-5 text-blue-600" />
                Daftar Demo
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredDemo.length} akun terdaftar)
                </span>
              </CardTitle>
              {canAddPembeli && (
                <Button
                  onClick={openAddPembeliDialog}
                  className="bg-blue-500 hover:bg-blue-600 text-white gap-2 text-xs sm:text-sm"
                  size="sm"
                >
                  <Plus className="size-4" />
                  Tambah Daftar Demo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari username atau email..."
                  value={pembeliSearch}
                  onChange={(e) => setPembeliSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead className="w-[200px]">Username</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="hidden md:table-cell w-[130px]">Terdaftar</TableHead>
                    <TableHead className="w-[140px]">Berakhir</TableHead>
                    <TableHead className="text-right w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <Loader2 className="size-5 animate-spin mx-auto text-blue-500" />
                      </TableCell>
                    </TableRow>
                  ) : filteredDemo.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Users className="size-8 opacity-30" />
                          <p className="text-sm">Belum ada akun terdaftar</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDemo.map((u, idx) => (
                      <TableRow key={u.id} className="group">
                        <TableCell className="text-muted-foreground text-sm text-center">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getRoleAvatarColor(u.role)}`}
                            >
                              {(u.username || u.name).charAt(0).toUpperCase()}
                            </div>
                            <p className="font-medium text-sm truncate">{u.username || u.name || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${getRoleBadgeClasses(u.role)}`}
                          >
                            {getRoleLabel(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${
                              u.isActive
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            }`}
                          >
                            <span className={`size-1.5 rounded-full inline-block ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
                            isExpired(u.demoExpiresAt)
                              ? 'text-red-600 bg-red-50 border-red-200'
                              : 'text-muted-foreground bg-white border-neutral-200'
                          }`}>
                            <CalendarClock className="size-3" />
                            {formatExpiryDate(u.demoExpiresAt)}
                            {isExpired(u.demoExpiresAt) && (
                              <span className="text-[10px] font-medium">(Expired)</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7 hover:bg-neutral-100" onClick={() => openEditDialog(u)} title="Edit">
                              <Pencil className="size-3.5" />
                            </Button>
                            {canDeletePembeli && user?.id !== u.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="Hapus"
                                onClick={() => setDeleteTarget(u)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* ═══════════════ Daftar Pembeli ═══════════════ */}
        {canViewPembeli && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <UserCog className="size-4 sm:size-5 text-emerald-600" />
                Daftar Pembeli
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredCustomer.length} akun terdaftar)
                </span>
              </CardTitle>
              {canAddPembeli && (
                <Button
                  onClick={openAddCustomerDialog}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 text-xs sm:text-sm"
                  size="sm"
                >
                  <Plus className="size-4" />
                  Tambah Daftar Pembeli
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari username atau email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead className="w-[200px]">Username</TableHead>
                    <TableHead className="w-[160px]">Role</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="hidden md:table-cell w-[130px]">Terdaftar</TableHead>
                    <TableHead className="text-right w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="size-5 animate-spin mx-auto text-emerald-500" />
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomer.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Users className="size-8 opacity-30" />
                          <p className="text-sm">Belum ada akun terdaftar</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomer.map((u, idx) => (
                      <TableRow key={u.id} className="group">
                        <TableCell className="text-muted-foreground text-sm text-center">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getRoleAvatarColor(u.role)}`}
                            >
                              {(u.username || u.name).charAt(0).toUpperCase()}
                            </div>
                            <p className="font-medium text-sm truncate">{u.username || u.name || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {(u.roles ? u.roles.split(',').map(r => r.trim()).filter(Boolean) : [u.role]).map((r, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${getRoleBadgeClasses(r)}`}
                              >
                                {getRoleLabel(r)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${
                              u.isActive
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            }`}
                          >
                            <span className={`size-1.5 rounded-full inline-block ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7 hover:bg-neutral-100" onClick={() => openEditDialog(u)} title="Edit">
                              <Pencil className="size-3.5" />
                            </Button>
                            {canDeletePembeli && user?.id !== u.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="Hapus"
                                onClick={() => setDeleteTarget(u)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}


      </div>

      {/* ═══════════════ ADD/EDIT DIALOG ═══════════════ */}
      <Dialog
        open={showAddDialog || !!editingUser}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[305px] max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingUser ? 'Edit User' : 'Tambah User Baru'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Perbarui informasi user di bawah ini.'
                : 'Isi data user baru. Password wajib diisi.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Avatar preview */}
            <div className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${getRoleAvatarColor(form.role)}`}
              >
                {form.name ? form.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs truncate">
                  {form.name || 'Nama User'}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {form.username ? `@${form.username}` : 'email@example.com'}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="user-name" className="text-xs">
                Nama <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-name"
                placeholder="Nama lengkap"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-username" className="text-xs">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-username"
                placeholder="Username untuk login"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-email" className="text-xs">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-password" className="text-xs">
                Password{' '}
                {editingUser ? (
                  <span className="text-muted-foreground font-normal">(kosongkan jika tidak diubah)</span>
                ) : (
                  <span className="text-red-500">*</span>
                )}
              </Label>
              <Input
                id="user-password"
                type="password"
                placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Password minimal 6 karakter'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-xs">Role</Label>
              {editingUser && editingUser.isPembeli ? (
                <div className="space-y-2 rounded-lg border p-3 bg-neutral-50/50">
                  <p className="text-[10px] text-muted-foreground">Pilih satu atau lebih role untuk pembeli ini:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableRoles
                      .filter((r) => r.key !== 'admin' && r.key !== 'demo')
                      .map((role) => (
                        <label
                          key={role.key}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-all text-xs ${
                            editRoles.includes(role.key)
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-neutral-200 hover:border-neutral-300 text-muted-foreground'
                          }`}
                        >
                          <Checkbox
                            checked={editRoles.includes(role.key)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEditRoles([...editRoles, role.key]);
                              } else if (editRoles.length > 1) {
                                setEditRoles(editRoles.filter((r) => r !== role.key));
                              }
                            }}
                            className="size-3.5"
                          />
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1 py-0 ${getRoleBadgeClasses(role.key)}`}
                          >
                            {role.label}
                          </Badge>
                        </label>
                      ))}
                  </div>
                  {editRoles.length === 0 && (
                    <p className="text-[10px] text-amber-600">Pilih minimal 1 role</p>
                  )}
                </div>
              ) : (
                <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.key} value={role.key}>
                        <span className="flex items-center gap-2">
                          <Shield className="size-3.5 text-muted-foreground" />
                          {role.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {editingUser && editingUser.isDemo && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-expiry" className="flex items-center gap-1.5 text-xs">
                  <CalendarClock className="size-3" />
                  Expired Date
                </Label>
                <Input
                  id="edit-expiry"
                  type="date"
                  value={editExpiryDate}
                  onChange={(e) => setEditExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  placeholder="Pilih tanggal expired"
                  className="h-8 text-sm"
                />
              </div>
            )}

            {editingUser && (
              <div className="flex items-center justify-between">
                <Label htmlFor="user-status">Status</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {form.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <Switch
                    id="user-status"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                </div>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddDialog(false);
                setEditingUser(null);
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : editingUser ? (
                'Simpan'
              ) : (
                'Tambah'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ ADD PEMBELI DIALOG ═══════════════ */}
      <Dialog open={showAddPembeliDialog} onOpenChange={(open) => { if (!open) setShowAddPembeliDialog(false); }}>
        <DialogContent className="sm:max-w-[380px] max-w-[calc(100vw-2rem)]">
          <DialogHeader className="text-center pb-0">
            {/* Logo / Icon */}
            <div className="mx-auto mb-3 w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 via-orange-400 to-rose-400 flex items-center justify-center shadow-lg shadow-orange-300/30">
              <Cake className="w-7 h-7 text-white" strokeWidth={1.8} />
            </div>
            <DialogTitle className="text-base font-bold text-center bg-gradient-to-r from-blue-700 via-orange-600 to-rose-600 bg-clip-text text-transparent">
              Tambah Akun Demo
            </DialogTitle>
            <DialogDescription className="text-xs text-center text-muted-foreground">
              Buat akun demo baru. Akun akan otomatis masuk ke Daftar Demo dengan masa trial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Error message */}
            {pembeliSubmitError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-600">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{pembeliSubmitError}</span>
              </div>
            )}

            {/* Nama field */}
            <div className="space-y-1.5">
              <Label htmlFor="pembeli-name" className="text-blue-900/70 text-xs font-medium">
                Nama <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                <Input
                  id="pembeli-name"
                  placeholder="Nama lengkap"
                  value={pembeliForm.name}
                  onChange={(e) => setPembeliForm({ ...pembeliForm, name: e.target.value })}
                  className="pl-10 h-10 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 text-sm"
                  disabled={isSubmittingPembeli}
                />
              </div>
            </div>

            {/* Username field */}
            <div className="space-y-1.5">
              <Label htmlFor="pembeli-username" className="text-blue-900/70 text-xs font-medium">
                Username <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
                <Input
                  id="pembeli-username"
                  placeholder="Username untuk login"
                  value={pembeliForm.username}
                  onChange={(e) => setPembeliForm({ ...pembeliForm, username: e.target.value })}
                  className="pl-10 h-10 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 text-sm"
                  disabled={isSubmittingPembeli}
                />
              </div>
            </div>

            {/* No. Handphone field */}
            <div className="space-y-1.5">
              <Label htmlFor="pembeli-phone" className="text-blue-900/70 text-xs font-medium">
                No. Handphone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                <Input
                  id="pembeli-phone"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={pembeliForm.phone}
                  onChange={(e) => setPembeliForm({ ...pembeliForm, phone: e.target.value })}
                  className="pl-10 h-10 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 text-sm"
                  disabled={isSubmittingPembeli}
                />
              </div>
            </div>

            {/* Email field */}
            <div className="space-y-1.5">
              <Label htmlFor="pembeli-email" className="text-blue-900/70 text-xs font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                <Input
                  id="pembeli-email"
                  type="email"
                  placeholder="nama@email.com"
                  value={pembeliForm.email}
                  onChange={(e) => setPembeliForm({ ...pembeliForm, email: e.target.value })}
                  className="pl-10 h-10 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 text-sm"
                  disabled={isSubmittingPembeli}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <Label htmlFor="pembeli-password" className="text-blue-900/70 text-xs font-medium">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                <Input
                  id="pembeli-password"
                  type={showPembeliPassword ? 'text' : 'password'}
                  placeholder="Minimal 6 karakter"
                  value={pembeliForm.password}
                  onChange={(e) => setPembeliForm({ ...pembeliForm, password: e.target.value })}
                  className="pl-10 pr-10 h-10 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 text-sm"
                  disabled={isSubmittingPembeli}
                />
                <button
                  type="button"
                  onClick={() => setShowPembeliPassword(!showPembeliPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPembeliPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="space-y-1.5">
              <Label htmlFor="pembeli-confirm-password" className="text-blue-900/70 text-xs font-medium">
                Konfirmasi Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                <Input
                  id="pembeli-confirm-password"
                  type={showPembeliConfirmPassword ? 'text' : 'password'}
                  placeholder="Ulangi password"
                  value={pembeliForm.confirmPassword}
                  onChange={(e) => setPembeliForm({ ...pembeliForm, confirmPassword: e.target.value })}
                  className="pl-10 pr-10 h-10 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 text-sm"
                  disabled={isSubmittingPembeli}
                />
                <button
                  type="button"
                  onClick={() => setShowPembeliConfirmPassword(!showPembeliConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPembeliConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPembeliDialog(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleAddPembeli}
              disabled={isSubmittingPembeli}
              size="sm"
              className="flex-1 h-10 bg-gradient-to-r from-blue-500 via-orange-500 to-rose-500 hover:from-blue-600 hover:via-orange-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-orange-300/30 transition-all duration-300"
            >
              {isSubmittingPembeli ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Tambah'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ ADD CUSTOMER PEMBELI DIALOG ═══════════════ */}
      <Dialog open={showAddCustomerDialog} onOpenChange={(open) => { if (!open) setShowAddCustomerDialog(false); }}>
        <DialogContent className="sm:max-w-[380px] max-w-[calc(100vw-2rem)]">
          <DialogHeader className="text-center pb-0">
            <div className="mx-auto mb-3 w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-300/30">
              <User className="w-7 h-7 text-white" strokeWidth={1.8} />
            </div>
            <DialogTitle className="text-base font-bold text-center bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Tambah Daftar Pembeli
            </DialogTitle>
            <DialogDescription className="text-xs text-center text-muted-foreground">
              Buat akun pembeli baru. Akun akan masuk ke Daftar Pembeli.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {customerSubmitError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-600">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{customerSubmitError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="customer-name" className="text-emerald-900/70 text-xs font-medium">
                Nama <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  id="customer-name"
                  placeholder="Nama lengkap"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="pl-10 h-10 border-emerald-200/60 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-400/20 placeholder:text-emerald-300/50 text-sm"
                  disabled={isSubmittingCustomer}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-username" className="text-emerald-900/70 text-xs font-medium">
                Username <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400" />
                <Input
                  id="customer-username"
                  placeholder="Username untuk login"
                  value={customerForm.username}
                  onChange={(e) => setCustomerForm({ ...customerForm, username: e.target.value })}
                  className="pl-10 h-10 border-emerald-200/60 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-400/20 placeholder:text-emerald-300/50 text-sm"
                  disabled={isSubmittingCustomer}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-phone" className="text-emerald-900/70 text-xs font-medium">
                No. Handphone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  id="customer-phone"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="pl-10 h-10 border-emerald-200/60 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-400/20 placeholder:text-emerald-300/50 text-sm"
                  disabled={isSubmittingCustomer}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-email" className="text-emerald-900/70 text-xs font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="nama@email.com"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="pl-10 h-10 border-emerald-200/60 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-400/20 placeholder:text-emerald-300/50 text-sm"
                  disabled={isSubmittingCustomer}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-password" className="text-emerald-900/70 text-xs font-medium">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  id="customer-password"
                  type={showCustomerPassword ? 'text' : 'password'}
                  placeholder="Minimal 6 karakter"
                  value={customerForm.password}
                  onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })}
                  className="pl-10 pr-10 h-10 border-emerald-200/60 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-400/20 placeholder:text-emerald-300/50 text-sm"
                  disabled={isSubmittingCustomer}
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerPassword(!showCustomerPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-emerald-600 transition-colors"
                  tabIndex={-1}
                >
                  {showCustomerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-confirm-password" className="text-emerald-900/70 text-xs font-medium">
                Konfirmasi Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  id="customer-confirm-password"
                  type={showCustomerConfirmPassword ? 'text' : 'password'}
                  placeholder="Ulangi password"
                  value={customerForm.confirmPassword}
                  onChange={(e) => setCustomerForm({ ...customerForm, confirmPassword: e.target.value })}
                  className="pl-10 pr-10 h-10 border-emerald-200/60 bg-emerald-50/30 focus:border-emerald-400 focus:ring-emerald-400/20 placeholder:text-emerald-300/50 text-sm"
                  disabled={isSubmittingCustomer}
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerConfirmPassword(!showCustomerConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-emerald-600 transition-colors"
                  tabIndex={-1}
                >
                  {showCustomerConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddCustomerDialog(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={isSubmittingCustomer}
              size="sm"
              className="flex-1 h-10 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-emerald-300/30 transition-all duration-300"
            >
              {isSubmittingCustomer ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Tambah'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ CHANGE PASSWORD DIALOG ═══════════════ */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-[305px] max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4 text-amber-600" />
              Reset Password
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reset password untuk user <span className="font-semibold">{passwordForm.userName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs">
                Password Baru <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Password minimal 6 karakter"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">
                Konfirmasi Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Ulangi password baru"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-1.5 p-2 rounded-md bg-emerald-50 text-emerald-600 text-xs">
                <ShieldCheck className="size-3 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasswordDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Mengubah...
                </>
              ) : (
                'Ubah Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DELETE CONFIRMATION DIALOG ═══════════════ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus user{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>? Data user akan
              dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Hapus'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
