'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/lib/auth-store';
import { usePermission } from '@/hooks/use-permission';
import { useIsMobile } from '@/hooks/use-mobile';

// ── Types ──────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  _count?: { transactions: number };
  totalBelanja?: number;
}

interface CustomerTransaction {
  id: string;
  invoiceNumber: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    productPrice: number;
    quantity: number;
    subtotal: number;
    product?: { id: string; name: string };
  }[];
  user: { id: string; name: string };
}

interface CustomerDetail extends Omit<Customer, '_count'> {
  transactions: CustomerTransaction[];
  totalBelanja?: number;
}

interface CustomerForm {
  name: string;
  phone: string;
  address: string;
}

// ── Helpers ────────────────────────────────────────────
function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const emptyForm: CustomerForm = { name: '', phone: '', address: '' };

function getPaymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit: 'Debit',
  };
  return map[method] || method;
}

// ── Component ──────────────────────────────────────────
export default function CustomersPage() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  // ── Permission checks ──
  const canAdd = usePermission('customer_add');
  const canEdit = usePermission('customer_edit');
  const canDelete = usePermission('customer_delete');

  // ── Data state ──
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── UI state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Delete dialog state ──
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Purchase history dialog ──
  const [historyCustomer, setHistoryCustomer] = useState<CustomerDetail | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // ── Form state ──
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  // ── Derived: form dialog open ──
  const formDialogOpen = showAddDialog || !!editingCustomer;

  // ── API Helper ──
  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token]
  );

  // ── Load customers ──
  const loadCustomers = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/customers?${params.toString()}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat data customer');
      const data = await res.json();
      setCustomers(data);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  }, [token, searchQuery, authHeaders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  // ── Filter customers (client-side for additional filtering) ──
  const filteredCustomers = useMemo(() => {
    return customers;
  }, [customers]);

  // ── Form handlers ──
  const openAddDialog = () => {
    setForm(emptyForm);
    setSubmitError('');
    setShowAddDialog(true);
  };

  const openEditDialog = (customer: Customer) => {
    setForm({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
    });
    setEditingCustomer(customer);
    setSubmitError('');
  };

  const closeFormDialog = () => {
    setShowAddDialog(false);
    setEditingCustomer(null);
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setSubmitError('Nama customer wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      };

      if (editingCustomer) {
        const res = await fetch(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          ...authHeaders,
          headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal mengupdate customer');
        }
      } else {
        const res = await fetch('/api/customers', {
          method: 'POST',
          ...authHeaders,
          headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menambah customer');
        }
      }

      closeFormDialog();
      loadCustomers(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, {
        method: 'DELETE',
        ...authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus customer');
      }
      setDeleteTarget(null);
      loadCustomers(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Purchase history ──
  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(null);
    setShowHistoryDialog(true);
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat riwayat');
      const data = await res.json();
      setHistoryCustomer(data);
    } catch (err) {
      setHistoryCustomer(null);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // ── Shared form content for add/edit dialog ──
  const renderFormContent = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="name">
          Nama <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Nama lengkap customer"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={isMobile ? 'h-12 text-base' : ''}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">No. HP</Label>
        <Input
          id="phone"
          placeholder="08xx-xxxx-xxxx"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={isMobile ? 'h-12 text-base' : ''}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Alamat</Label>
        <Input
          id="address"
          placeholder="Alamat customer"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className={isMobile ? 'h-12 text-base' : ''}
          autoComplete="off"
        />
      </div>

      {submitError && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}
    </div>
  );

  // ── Shared history content ──
  const renderHistoryContent = () => (
    <>
      {/* Customer info summary */}
      {historyCustomer && (
        <div className="flex flex-wrap gap-4 text-sm bg-neutral-50 rounded-lg p-3">
          {historyCustomer.phone && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3.5" />
              {historyCustomer.phone}
            </span>
          )}
          {historyCustomer.address && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" />
              {historyCustomer.address}
            </span>
          )}
        </div>
      )}

      {/* Total belanja summary */}
      {historyCustomer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">Total Belanja</span>
          <span className="text-lg font-bold text-blue-800">{formatRupiah(historyCustomer.totalBelanja || 0)}</span>
        </div>
      )}

      {/* Transaction list */}
      <ScrollArea className={isMobile ? 'max-h-[50vh]' : 'max-h-[400px]'}>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-blue-500" />
          </div>
        ) : historyCustomer && historyCustomer.transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShoppingBag className="size-10 mb-2 opacity-30" />
            <p className="text-sm">Belum ada transaksi</p>
          </div>
        ) : historyCustomer ? (
          <div className="space-y-3 pr-3">
            {historyCustomer.transactions.map((tx) => (
              <Card key={tx.id} className="border-neutral-200">
                <CardContent className="p-4 space-y-3">
                  {/* Transaction header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{tx.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(tx.createdAt)} • Kasir: {tx.user.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-700">
                        {formatRupiah(tx.total)}
                      </p>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {getPaymentLabel(tx.paymentMethod)}
                      </Badge>
                    </div>
                  </div>

                  {/* Items */}
                  <Separator />
                  <div className="space-y-1.5">
                    {tx.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.quantity}x {item.productName}
                        </span>
                        <span>{formatRupiah(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </ScrollArea>
    </>
  );

  // ── Loading state ──
  if (isLoading && customers.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Memuat data customer...</p>
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
              Daftar Customer
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola data pelanggan toko
            </p>
          </div>
          {canAdd && (
          <Button
            onClick={openAddDialog}
            className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
          >
            <Plus className="size-4" />
            Tambah Customer
          </Button>
          )}
        </div>

        {/* ═══════════════ Search ═══════════════ */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau nomor HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════ Error state ═══════════════ */}
        {loadError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="size-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{loadError}</p>
              <Button variant="outline" size="sm" onClick={loadCustomers} className="ml-auto">
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ Table ═══════════════ */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[200px]">Nama</TableHead>
                    <TableHead className="w-[140px]">No. HP</TableHead>
                    <TableHead className="hidden md:table-cell w-[200px]">Alamat</TableHead>
                    <TableHead className="text-right w-[140px]">Total Belanja</TableHead>
                    <TableHead className="text-right w-[160px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Users className="size-10 opacity-30" />
                          <p className="text-sm font-medium">Belum ada customer</p>
                          <p className="text-xs">
                            {searchQuery
                              ? 'Tidak ada hasil yang cocok'
                              : 'Klik tombol "Tambah Customer" untuk menambah data baru'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id} className="group">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{customer.name}</p>
                            {customer._count && (
                              <p className="text-xs text-muted-foreground">
                                {customer._count.transactions} transaksi
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <span className="text-sm flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="size-3" />
                              {customer.phone}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {customer.address ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="size-3 shrink-0" />
                              <span className="line-clamp-1">{customer.address}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-blue-700">
                            {formatRupiah(customer.totalBelanja || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openHistory(customer)}
                              title="Lihat Riwayat"
                            >
                              <Eye className="size-4" />
                            </Button>
                            {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 hover:bg-neutral-100"
                              onClick={() => openEditDialog(customer)}
                              title="Edit"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            )}
                            {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              title="Hapus"
                              onClick={() => {
                                setDeleteTarget(customer);
                                setDeleteError('');
                              }}
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
      </div>

      {/* ═══════════════ ADD/EDIT DIALOG ═══════════════ */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => { if (!open) closeFormDialog(); }}>
        <DialogContent className={isMobile ? "w-[calc(100vw-2rem)] max-w-full p-0 gap-0 [&>button]:hidden" : "sm:max-w-md max-w-[calc(100vw-2rem)]"}>
          {isMobile ? (
            <>
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                <DialogTitle className="text-lg font-semibold">
                  {editingCustomer ? 'Edit Customer' : 'Tambah Customer Baru'}
                </DialogTitle>
                <button onClick={closeFormDialog} className="rounded-full p-1 hover:bg-neutral-100 transition-colors">
                  <X className="size-5 text-neutral-500" />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                {renderFormContent()}
              </div>
              <div className="flex gap-2 px-4 pb-4 pt-3 border-t">
                <Button variant="outline" onClick={closeFormDialog} disabled={isSubmitting} className="flex-1 h-11">
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 h-11 gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : editingCustomer ? (
                    'Simpan'
                  ) : (
                    'Tambah'
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Edit Customer' : 'Tambah Customer Baru'}
                </DialogTitle>
                <DialogDescription>
                  {editingCustomer
                    ? 'Perbarui informasi customer di bawah ini.'
                    : 'Isi data customer baru.'}
                </DialogDescription>
              </DialogHeader>
              {renderFormContent()}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeFormDialog}>
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : editingCustomer ? (
                    'Simpan Perubahan'
                  ) : (
                    'Tambah Customer'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DELETE CONFIRMATION DIALOG ═══════════════ */}
      {isMobile ? (
        /* Mobile: Bottom sheet drawer */
        <Drawer open={!!deleteTarget} onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                Hapus Customer
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600">
                Apakah Anda yakin ingin menghapus customer{' '}
                <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
              {deleteError && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs mt-3">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>
            <DrawerFooter className="gap-2">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError('');
                  }
                }}
                className="h-12"
              >
                Batal
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-12 gap-2 bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeleting && <Loader2 className="size-5 animate-spin" />}
                Ya, Hapus
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Centered dialog */
        <Dialog open={!!deleteTarget} onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}>
          <DialogContent
            className="sm:max-w-md"
            onPointerDownOutside={(e) => { if (isDeleting) e.preventDefault(); }}
            onInteractOutside={(e) => { if (isDeleting) e.preventDefault(); }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                Hapus Customer
              </DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin menghapus customer{' '}
                <span className="font-semibold">{deleteTarget?.name}</span>? Tindakan ini
                tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
              >
                Batal
              </Button>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══════════════ PURCHASE HISTORY DIALOG ═══════════════ */}
      {isMobile ? (
        /* Mobile: Bottom sheet drawer */
        <Drawer open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DrawerContent className="max-h-[90dvh]">
            <DrawerHeader className="text-left border-b pb-4">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                <ShoppingBag className="size-5 text-blue-600" />
                Riwayat Belanja
              </DrawerTitle>
              <DrawerDescription>
                {historyCustomer
                  ? `${historyCustomer.name} — ${historyCustomer.transactions?.length || 0} transaksi`
                  : 'Memuat data...'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              {renderHistoryContent()}
            </div>
            <DrawerFooter className="border-t pt-4 gap-2">
              <DrawerClose asChild>
                <Button variant="outline" className="h-12">
                  Tutup
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Centered dialog */
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="size-5 text-blue-600" />
                Riwayat Belanja
              </DialogTitle>
              <DialogDescription>
                {historyCustomer
                  ? `${historyCustomer.name} — ${historyCustomer.transactions?.length || 0} transaksi`
                  : 'Memuat data...'}
              </DialogDescription>
            </DialogHeader>
            {renderHistoryContent()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
