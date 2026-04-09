'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Search,
  Calendar,
  Filter,
  Eye,
  Download,
  Upload,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt,
  CheckCircle2,
  Trash2,
  Pencil,
  Printer,
  Store,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// ── Types ──────────────────────────────────────────────
interface TransactionItem {
  id: string;
  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;
  product?: { id: string; name: string };
}

interface Transaction {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  createdAt: string;
  user: { id: string; name: string };
  customer: { id: string; name: string; phone: string | null } | null;
  items: TransactionItem[];
}

interface TransactionDetail extends Transaction {
  customer: { id: string; name: string; phone: string | null; address: string | null } | null;
}

interface PaginatedResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  receiptFooter: string;
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPaymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit: 'Debit',
  };
  return map[method] || method;
}

function getPaymentBadgeClass(method: string): string {
  const map: Record<string, string> = {
    cash: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    transfer: 'bg-sky-100 text-sky-700 border-sky-200',
    qris: 'bg-purple-100 text-purple-700 border-purple-200',
    debit: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return map[method] || 'bg-neutral-100 text-neutral-700';
}

// ── Component ──────────────────────────────────────────
export default function TransactionHistoryPage() {
  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();
  const canFilter = usePermission('transaction_filter');
  const canExport = usePermission('transaction_export');
  const canDeleteTx = usePermission('transaction_delete');
  const canEditTx = usePermission('transaction_edit');
  const canReprint = usePermission('transaction_reprint');
  const canRefund = usePermission('pos_refund');
  const canViewDetail = usePermission('transaction_detail');

  // ── Data state ──
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Filter state ──
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Detail dialog ──
  const [selectedTx, setSelectedTx] = useState<TransactionDetail | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // ── Receipt reprint dialog ──
  const [receiptTx, setReceiptTx] = useState<TransactionDetail | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  // ── Refund dialog ──
  const [refundTx, setRefundTx] = useState<TransactionDetail | null>(null);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState(false);

  // ── Load store settings for receipt ──
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setStoreSettings({
            storeName: data.storeName || 'Sweet Bakery & Food',
            address: data.address || '',
            phone: data.phone || '',
            receiptFooter: data.receiptFooter || 'Terima kasih atas kunjungan Anda!',
          });
        }
      } catch { /* use defaults */ }
    };
    if (token) loadSettings();
  }, [token]);

  // ── Edit dialog ──
  const [editTx, setEditTx] = useState<TransactionDetail | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ── API Helper ──
  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token]
  );

  // ── Load transactions ──
  const loadTransactions = useCallback(
    async (page = 1, silent = false) => {
      if (!token) return;
      try {
        if (!silent) setIsLoading(true);
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '20');
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());

        const res = await fetch(`/api/transactions?${params.toString()}`, authHeaders);
        if (!res.ok) throw new Error('Gagal memuat data transaksi');
        const data: PaginatedResponse = await res.json();
        setTransactions(data.transactions);
        setPagination(data.pagination);
        setLoadError('');
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        setIsLoading(false);
      }
    },
    [token, startDate, endDate, paymentMethod, searchQuery, authHeaders]
  );

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions]);

  // ── Pagination ──
  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    loadTransactions(page);
  };

  // ── Reset filters ──
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setPaymentMethod('all');
    setSearchQuery('');
  };

  // ── View detail ──
  const openDetail = async (tx: Transaction) => {
    setSelectedTx(null);
    setShowDetailDialog(true);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat detail');
      const data = await res.json();
      setSelectedTx(data);
    } catch {
      setSelectedTx(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ── Reprint receipt ──
  const openReceipt = async (tx: Transaction) => {
    setReceiptTx(null);
    setShowReceiptDialog(true);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat detail');
      const data = await res.json();
      setReceiptTx(data);
    } catch {
      setReceiptTx(null);
      setShowReceiptDialog(false);
    }
  };

  // ── Open refund dialog ──
  const openRefund = async (tx: Transaction) => {
    setRefundTx(null);
    setRefundReason('');
    setRefundError('');
    setRefundSuccess(false);
    setShowRefundDialog(true);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat detail');
      const data = await res.json();
      setRefundTx(data);
    } catch {
      setRefundTx(null);
      setShowRefundDialog(false);
    }
  };

  // ── Process refund ──
  const handleRefund = async () => {
    if (!refundTx) return;
    if (!refundReason.trim()) {
      setRefundError('Alasan retur wajib diisi');
      return;
    }
    setIsRefunding(true);
    setRefundError('');
    try {
      const res = await fetch('/api/transactions/refund', {
        method: 'POST',
        ...authHeaders,
        headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: refundTx.id,
          reason: refundReason.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memproses retur');
      }
      setRefundSuccess(true);
      // Update transaction in list with refund status
      setTransactions((prev) =>
        prev.map((t) => (t.id === refundTx.id ? { ...t, refundReason: refundReason.trim() } : t))
      );
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Gagal memproses retur');
    } finally {
      setIsRefunding(false);
    }
  };

  // ── Edit transaction ──
  const openEditDialog = (tx: Transaction) => {
    setEditTx(tx as TransactionDetail);
    setEditPaymentMethod(tx.paymentMethod);
    setEditCustomerName(tx.customer?.name || '');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editTx) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/transactions/${editTx.id}`, {
        method: 'PUT',
        ...authHeaders,
        headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: editPaymentMethod,
          customerName: editCustomerName,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan perubahan');
      }
      setShowEditDialog(false);
      setEditTx(null);
      loadTransactions(1, true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan perubahan');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Delete transaction ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/transactions/${deleteTarget.id}`, {
        method: 'DELETE',
        ...authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus transaksi');
      }
      setTransactions((prev) => prev.filter((tx) => tx.id !== deleteTarget.id));
      setDeleteTarget(null);
      loadTransactions(1, true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus transaksi');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Export to Excel ──
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const body: Record<string, string> = {};
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (paymentMethod !== 'all') body.paymentMethod = paymentMethod;
      if (searchQuery.trim()) body.search = searchQuery.trim();

      const res = await fetch('/api/transactions/export', {
        method: 'POST',
        ...authHeaders,
        headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal export data');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `penjualan_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Reload transactions after export (they were deleted)
      loadTransactions(1, true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal export data');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Import from Excel ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Format file harus .xlsx atau .xls');
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal import data');
      alert(`Berhasil import ${data.importedCount} transaksi${data.skippedCount > 0 ? ` (${data.skippedCount} duplikat dilewati)` : ''}`);
      loadTransactions(1, true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal import data');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  // ── Summary stats ──
  const totalAmount = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.total, 0),
    [transactions]
  );

  const hasActiveFilters = startDate || endDate || paymentMethod !== 'all' || searchQuery.trim();

  // ── Loading state ──
  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Memuat riwayat penjualan...</p>
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
                <FileText className="size-5 text-blue-700" />
              </div>
              Riwayat Penjualan
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pagination.total} transaksi ditemukan
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
            <>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import Data
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              className="gap-2"
              disabled={isExporting || transactions.length === 0}
            >
              {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export Data
            </Button>
            </>
            )}
          </div>
        </div>

        {/* ═══════════════ Filters ═══════════════ */}
        {canFilter && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={resetFilters}>
                  Reset Filter
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Start date */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              {/* End date */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Semua metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Metode</SelectItem>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="qris">QRIS</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cari Invoice/Customer</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="INV-xxx atau nama..."
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
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* ═══════════════ Error state ═══════════════ */}
        {loadError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="size-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => loadTransactions(1)} className="ml-auto">
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ Summary Cards ═══════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs text-muted-foreground mb-1">Total Transaksi (halaman ini)</p>
              <p className="text-xl sm:text-2xl font-bold text-neutral-900">{transactions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs text-muted-foreground mb-1">Total Penjualan (halaman ini)</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-700">{formatRupiah(totalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="hidden sm:block">
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs text-muted-foreground mb-1">Total Keseluruhan</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700">{pagination.total} transaksi</p>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════ Table ═══════════════ */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[140px]">Invoice</TableHead>
                    <TableHead className="w-[110px]">Tanggal</TableHead>
                    <TableHead className="hidden md:table-cell w-[120px]">Kasir</TableHead>
                    <TableHead className="hidden sm:table-cell w-[140px]">Customer</TableHead>
                    <TableHead className="text-right w-[130px]">Total</TableHead>
                    <TableHead className="hidden sm:table-cell w-[100px]">Metode</TableHead>
                    <TableHead className="text-right w-[120px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Receipt className="size-10 opacity-30" />
                          <p className="text-sm font-medium">Tidak ada transaksi</p>
                          <p className="text-xs">
                            {hasActiveFilters
                              ? 'Coba ubah filter untuk menampilkan hasil'
                              : 'Belum ada data penjualan'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id} className="group">
                        <TableCell>
                          <p className="font-mono text-xs font-semibold text-neutral-800">
                            {tx.invoiceNumber}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(tx.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{tx.user.name}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {tx.customer?.name || 'Umum'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-blue-700">
                            {formatRupiah(tx.total)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${getPaymentBadgeClass(tx.paymentMethod)}`}
                          >
                            {getPaymentLabel(tx.paymentMethod)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canReprint && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openReceipt(tx)}
                                title="Cetak Struk"
                              >
                                <Printer className="size-4" />
                              </Button>
                            )}
                            {canRefund && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => openRefund(tx)}
                                title="Retur / Refund"
                              >
                                <RotateCcw className="size-4" />
                              </Button>
                            )}
                            {canViewDetail && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => openDetail(tx)}
                                title="Lihat Detail"
                              >
                                <Eye className="size-4" />
                              </Button>
                            )}
                            {canEditTx && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => openEditDialog(tx)}
                                title="Edit Transaksi"
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            {canDeleteTx && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteTarget(tx)}
                                title="Hapus Transaksi"
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

        {/* ═══════════════ Pagination ═══════════════ */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Halaman {pagination.page} dari {pagination.totalPages}
            </p>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>

              {/* Page buttons */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? 'default' : 'outline'}
                      size="icon"
                      className="size-8"
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ DELETE CONFIRMATION (Desktop) ═══════════════ */}
      {!isMobile && (
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus transaksi{' '}
                <span className="font-semibold">{deleteTarget?.invoiceNumber}</span>?{' '}
                Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="size-4 animate-spin mr-2" />}
                Hapus
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ═══════════════ DELETE CONFIRMATION (Mobile) ═══════════════ */}
      {isMobile && (
        <Drawer open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Hapus Transaksi</DrawerTitle>
              <DrawerDescription>
                Apakah Anda yakin ingin menghapus transaksi{' '}
                <span className="font-semibold">{deleteTarget?.invoiceNumber}</span>?{' '}
                Tindakan ini tidak dapat dibatalkan.
              </DrawerDescription>
            </DrawerHeader>
            {deleteError && (
              <p className="px-4 text-sm text-red-600">{deleteError}</p>
            )}
            <DrawerFooter className="flex-col gap-2 pt-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full"
              >
                {isDeleting && <Loader2 className="size-4 animate-spin mr-2" />}
                Hapus
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full" disabled={isDeleting}>
                  Batal
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {/* ═══════════════ EDIT DIALOG ═══════════════ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-amber-600" />
              Edit Transaksi
            </DialogTitle>
            <DialogDescription>
              {editTx ? editTx.invoiceNumber : 'Memuat data...'}
            </DialogDescription>
          </DialogHeader>

          {editTx && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nomor Invoice</Label>
                <p className="text-sm font-mono font-semibold">{editTx.invoiceNumber}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCustomerName" className="text-xs text-muted-foreground">
                  Nama Customer
                </Label>
                <Input
                  id="editCustomerName"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="Umum"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Metode Pembayaran</Label>
                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="qris">QRIS</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSavingEdit}>
              Batal
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit && <Loader2 className="size-4 animate-spin mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DETAIL DIALOG ═══════════════ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-blue-600" />
              Detail Transaksi
            </DialogTitle>
            <DialogDescription>
              {selectedTx
                ? selectedTx.invoiceNumber
                : 'Memuat data...'}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-blue-500" />
            </div>
          ) : selectedTx ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-4 pr-3">
                {/* Transaction info */}
                <Card className="border-neutral-200">
                  <CardContent className="p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Invoice</span>
                      <span className="font-mono font-semibold text-right">{selectedTx.invoiceNumber}</span>

                      <span className="text-muted-foreground">Tanggal</span>
                      <span className="text-right">{formatDateTime(selectedTx.createdAt)}</span>

                      <span className="text-muted-foreground">Kasir</span>
                      <span className="text-right">{selectedTx.user.name}</span>

                      <span className="text-muted-foreground">Customer</span>
                      <span className="text-right">{selectedTx.customer?.name || 'Umum'}</span>

                      <span className="text-muted-foreground">Metode</span>
                      <span className="text-right">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${getPaymentBadgeClass(selectedTx.paymentMethod)}`}
                        >
                          {getPaymentLabel(selectedTx.paymentMethod)}
                        </Badge>
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Items */}
                <Card className="border-neutral-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                      Daftar Item
                    </p>
                    <div className="space-y-2">
                      {selectedTx.items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between text-sm">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} x {formatRupiah(item.productPrice)}
                            </p>
                          </div>
                          <span className="font-semibold">{formatRupiah(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Totals */}
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatRupiah(selectedTx.subtotal)}</span>
                    </div>
                    {selectedTx.discount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Diskon</span>
                        <span>-{formatRupiah(selectedTx.discount)}</span>
                      </div>
                    )}
                    {selectedTx.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pajak</span>
                        <span>{formatRupiah(selectedTx.tax)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-blue-700">{formatRupiah(selectedTx.total)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dibayar</span>
                      <span>{formatRupiah(selectedTx.amountPaid)}</span>
                    </div>
                    {selectedTx.change > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600">
                        <span>Kembalian</span>
                        <span className="font-semibold">{formatRupiah(selectedTx.change)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <AlertCircle className="size-8 mb-2" />
              <p className="text-sm">Gagal memuat detail transaksi</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ RECEIPT REPRINT DIALOG ═══════════════ */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center">
              <Receipt className="size-5 text-emerald-500" />
              Cetak Ulang Struk
            </DialogTitle>
            <DialogDescription className="text-center">
              {receiptTx ? receiptTx.invoiceNumber : 'Memuat...'}
            </DialogDescription>
          </DialogHeader>
          {receiptTx ? (
            <>
              <ScrollArea className="max-h-[60vh]">
                <div className="bg-white border-2 border-dashed border-neutral-300 rounded-lg p-4 font-mono text-xs pr-3">
                  {/* Store info */}
                  <div className="text-center mb-3">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Store className="size-4" />
                      <span className="font-bold text-sm">
                        {storeSettings?.storeName || 'Sweet Bakery & Food'}
                      </span>
                    </div>
                    {storeSettings?.address && <p className="text-muted-foreground">{storeSettings.address}</p>}
                    {storeSettings?.phone && <p className="text-muted-foreground">{storeSettings.phone}</p>}
                  </div>

                  <Separator className="my-2" />

                  {/* Transaction info */}
                  <div className="space-y-0.5 mb-2">
                    <div className="flex justify-between">
                      <span>No. Invoice</span>
                      <span className="font-semibold">{receiptTx.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tanggal</span>
                      <span>{formatDate(receiptTx.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Waktu</span>
                      <span>{formatTime(receiptTx.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kasir</span>
                      <span>{receiptTx.user.name}</span>
                    </div>
                    {receiptTx.customer && (
                      <div className="flex justify-between">
                        <span>Pelanggan</span>
                        <span>{receiptTx.customer.name}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-2" />

                  {/* Items */}
                  <div className="space-y-1.5 mb-2">
                    {receiptTx.items.map((item) => (
                      <div key={item.id}>
                        <p className="font-medium">{item.productName}</p>
                        <div className="flex justify-between text-muted-foreground pl-2">
                          <span>{item.quantity} x {formatRupiah(item.productPrice)}</span>
                          <span>{formatRupiah(item.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-2" />

                  {/* Totals */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatRupiah(receiptTx.subtotal)}</span>
                    </div>
                    {receiptTx.discount > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>Diskon</span>
                        <span>-{formatRupiah(receiptTx.discount)}</span>
                      </div>
                    )}
                    {receiptTx.tax > 0 && (
                      <div className="flex justify-between">
                        <span>Pajak</span>
                        <span>{formatRupiah(receiptTx.tax)}</span>
                      </div>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-sm">
                      <span>TOTAL</span>
                      <span>{formatRupiah(receiptTx.total)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between">
                      <span>{getPaymentLabel(receiptTx.paymentMethod)}</span>
                      <span>{formatRupiah(receiptTx.amountPaid)}</span>
                    </div>
                    {receiptTx.change > 0 && (
                      <div className="flex justify-between font-semibold">
                        <span>Kembalian</span>
                        <span>{formatRupiah(receiptTx.change)}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-2" />

                  {/* Footer */}
                  <p className="text-center text-muted-foreground italic">
                    {storeSettings?.receiptFooter || 'Terima kasih atas kunjungan Anda!'}
                  </p>
                </div>
              </ScrollArea>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4 mr-2" />
                  Cetak Struk
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowReceiptDialog(false)}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-blue-500" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ REFUND DIALOG ═══════════════ */}
      <Dialog open={showRefundDialog} onOpenChange={(open) => { if (!open && !isRefunding) setShowRefundDialog(false); }}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]"
          onPointerDownOutside={(e) => { if (isRefunding) e.preventDefault(); }}
          onInteractOutside={(e) => { if (isRefunding) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-amber-600" />
              Retur / Refund
            </DialogTitle>
            <DialogDescription>
              {refundTx ? refundTx.invoiceNumber : 'Memuat...'}
            </DialogDescription>
          </DialogHeader>

          {refundSuccess ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="rounded-full bg-emerald-100 p-4">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <p className="text-base font-semibold text-emerald-700">Retur Berhasil Diproses</p>
              <p className="text-sm text-muted-foreground text-center">
                Transaksi {refundTx?.invoiceNumber} telah ditandai sebagai retur.
              </p>
              <Button onClick={() => setShowRefundDialog(false)} className="mt-2">
                Tutup
              </Button>
            </div>
          ) : refundTx ? (
            <div className="space-y-4 py-2">
              {/* Transaction summary */}
              <Card className="border-amber-200 bg-amber-50/30">
                <CardContent className="p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold text-amber-700">{formatRupiah(refundTx.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Metode</span>
                    <span>{getPaymentLabel(refundTx.paymentMethod)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span>{refundTx.customer?.name || 'Umum'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Transaksi</p>
                {refundTx.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.productName}</span>
                    <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label htmlFor="refund-reason">Alasan Retur <span className="text-red-500">*</span></Label>
                <Textarea
                  id="refund-reason"
                  placeholder="Masukkan alasan retur..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>

              {refundError && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{refundError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-blue-500" />
            </div>
          )}

          {!refundSuccess && refundTx && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowRefundDialog(false)} disabled={isRefunding}>
                Batal
              </Button>
              <Button
                onClick={handleRefund}
                disabled={isRefunding}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isRefunding ? (
                  <><Loader2 className="size-4 animate-spin mr-2" /> Memproses...</>
                ) : (
                  <><RotateCcw className="size-4 mr-2" /> Proses Retur</>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
