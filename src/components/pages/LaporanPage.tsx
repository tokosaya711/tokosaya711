'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Receipt,
  Inbox,
  CalendarDays,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/auth-store';
import { usePermission } from '@/hooks/use-permission';
import { useIsMobile } from '@/hooks/use-mobile';

// ── Helper Functions ─────────────────────────────────────────────────────────

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
    month: '2-digit',
    year: 'numeric',
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

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getFirstDayOfMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLastDayOfMonthString(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function getMondayString(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyTransaction {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  user: { id: string; name: string };
  customer: { id: string; name: string } | null;
  paymentMethod: string;
  total: number;
}

interface MonthlyTransaction {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  user: { id: string; name: string };
  customer: { id: string; name: string } | null;
  paymentMethod: string;
  total: number;
}

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  transactions: DailyTransaction[];
  summary: {
    totalTransactions: number;
    totalPenjualan: number;
    totalModal: number;
    profit: number;
  };
  dailyBreakdown: {
    date: string;
    dayName: string;
    totalTransactions: number;
    totalPenjualan: number;
    totalModal: number;
    profit: number;
  }[];
}

interface QuarterlySummary {
  transactions: DailyTransaction[];
  summary: {
    totalTransactions: number;
    totalPenjualan: number;
    totalModal: number;
    profit: number;
  };
  monthlyBreakdown: {
    month: number;
    monthName: string;
    totalTransactions: number;
    totalPenjualan: number;
    totalModal: number;
    profit: number;
  }[];
}

interface FinancialSummary {
  totalPendapatan: number;
  totalDiskon: number;
  totalPajak: number;
  labaKotor: number;
  dailyBreakdown: {
    date: string;
    pendapatan: number;
    diskon: number;
    pajak: number;
    labaKotor: number;
    jumlahTransaksi: number;
  }[];
}

type TabKey = 'harian' | 'mingguan' | 'bulanan' | 'triwulan' | 'keuangan';

// ── Stat Card Component ──────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
  accentClass,
  iconBgClass,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accentClass: string;
  iconBgClass: string;
}) {
  return (
    <Card className="p-4 sm:p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`text-lg sm:text-2xl font-bold tracking-tight ${accentClass}`}>{value}</p>
        </div>
        <div className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl ${iconBgClass}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Loading Spinner ──────────────────────────────────────────────────────────

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">{message || 'Memuat data...'}</p>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message, subMessage }: { message: string; subMessage?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Inbox className="size-12 opacity-30" />
        <p className="text-sm font-medium">{message}</p>
        {subMessage && <p className="text-xs">{subMessage}</p>}
      </div>
    </div>
  );
}

// ── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex items-center gap-3 p-4">
        <AlertCircle className="size-5 text-red-500 shrink-0" />
        <p className="text-sm text-red-700 flex-1">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba Lagi
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Tab 1: Harian ────────────────────────────────────────────────────────────

function HarianTab() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  const [date, setDate] = useState(getTodayString());
  const [transactions, setTransactions] = useState<DailyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/laporan/harian?date=${date}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat laporan harian');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, date, authHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalTransaksi = transactions.length;
  const totalPenjualan = transactions.reduce((s, t) => s + t.total, 0);
  const rataRata = totalTransaksi > 0 ? Math.round(totalPenjualan / totalTransaksi) : 0;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter Tanggal</span>
          </div>
          <div className={isMobile ? 'space-y-2' : 'flex items-end gap-3'}>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Tanggal</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10"
              />
            </div>
            <Button onClick={fetchData} variant="outline" className="gap-2 h-10" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {isMobile ? 'Refresh' : 'Tampilkan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Summary */}
      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="Total Transaksi"
            value={String(totalTransaksi)}
            icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />}
            accentClass="text-blue-700"
            iconBgClass="bg-blue-50 text-blue-600"
          />
          <StatCard
            title="Total Penjualan"
            value={formatRupiah(totalPenjualan)}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            accentClass="text-emerald-700"
            iconBgClass="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            title="Rata-rata per Transaksi"
            value={formatRupiah(rataRata)}
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            accentClass="text-amber-700"
            iconBgClass="bg-amber-50 text-amber-600"
          />
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Detail Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner />
          ) : transactions.length === 0 ? (
            <EmptyState
              message="Tidak ada data transaksi"
              subMessage={`Belum ada transaksi pada tanggal ${formatDate(date)}`}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[60px] text-center">No</TableHead>
                    <TableHead className="w-[150px]">Invoice</TableHead>
                    <TableHead className="w-[130px]">Waktu</TableHead>
                    <TableHead className={isMobile ? 'hidden lg:table-cell' : ''}>Kasir</TableHead>
                    <TableHead className={isMobile ? 'hidden md:table-cell' : ''}>Customer</TableHead>
                    <TableHead className={isMobile ? 'hidden sm:table-cell' : ''}>Metode</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, idx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold text-neutral-800">
                          {tx.invoiceNumber}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(tx.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className={isMobile ? 'hidden lg:table-cell' : ''}>
                        <span className="text-sm">{tx.user?.name || '-'}</span>
                      </TableCell>
                      <TableCell className={isMobile ? 'hidden md:table-cell' : ''}>
                        <span className="text-sm text-muted-foreground">
                          {tx.customer?.name || 'Umum'}
                        </span>
                      </TableCell>
                      <TableCell className={isMobile ? 'hidden sm:table-cell' : ''}>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${getPaymentBadgeClass(tx.paymentMethod)}`}
                        >
                          {getPaymentLabel(tx.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-blue-700">
                          {formatRupiah(tx.total)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 2: Mingguan ──────────────────────────────────────────────────────────

function MingguanTab() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  const [weekStart, setWeekStart] = useState(getMondayString);
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/laporan/mingguan?weekStart=${weekStart}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat laporan mingguan');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, weekStart, authHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateWeek = (direction: -1 | 1) => {
    const current = new Date(weekStart + 'T00:00:00');
    current.setDate(current.getDate() + direction * 7);
    const newMonday = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    setWeekStart(newMonday);
  };

  const weekEnd = useMemo(() => {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  }, [weekStart]);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Navigasi Minggu</span>
          </div>
          <div className={isMobile ? 'space-y-2' : 'flex items-center gap-3'}>
            <Button
              onClick={() => navigateWeek(-1)}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={isLoading}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-neutral-800">
                {formatDate(weekStart)} — {formatDate(weekEnd)}
              </p>
            </div>
            <Button
              onClick={() => navigateWeek(1)}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={isLoading}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Loading */}
      {!error && isLoading && <LoadingSpinner />}

      {/* Content */}
      {!error && !isLoading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Transaksi"
              value={String(data.summary.totalTransactions)}
              icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-blue-700"
              iconBgClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              title="Total Penjualan"
              value={formatRupiah(data.summary.totalPenjualan)}
              icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-emerald-700"
              iconBgClass="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Total Modal"
              value={formatRupiah(data.summary.totalModal)}
              icon={<Receipt className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-red-600"
              iconBgClass="bg-red-50 text-red-500"
            />
            <StatCard
              title="Laba Bersih"
              value={formatRupiah(data.summary.profit)}
              icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-amber-700"
              iconBgClass="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Daily Breakdown Table */}
          {data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Rincian Harian</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                          <TableHead className="w-[60px] text-center">No</TableHead>
                          <TableHead>Hari</TableHead>
                          <TableHead className={isMobile ? 'hidden sm:table-cell' : ''}>Tanggal</TableHead>
                          <TableHead className="text-center">Transaksi</TableHead>
                          <TableHead className="text-right">Penjualan</TableHead>
                          <TableHead className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                            Modal
                          </TableHead>
                          <TableHead className="text-right">Laba</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.dailyBreakdown.map((day, idx) => (
                          <TableRow key={day.date}>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{day.dayName}</span>
                            </TableCell>
                            <TableCell className={isMobile ? 'hidden sm:table-cell' : ''}>
                              <span className="text-sm text-muted-foreground">{formatDate(day.date)}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {day.totalTransactions}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-emerald-700">
                                {formatRupiah(day.totalPenjualan)}
                              </span>
                            </TableCell>
                            <TableCell className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                              <span className="text-sm text-red-600">
                                {formatRupiah(day.totalModal)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-bold text-blue-700">
                                {formatRupiah(day.profit)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {data.dailyBreakdown && data.dailyBreakdown.length === 0 && (
            <EmptyState
              message="Tidak ada data transaksi"
              subMessage={`Belum ada transaksi pada minggu ${formatDate(weekStart)} — ${formatDate(weekEnd)}`}
            />
          )}
        </>
      )}

      {!error && !isLoading && !data && (
        <EmptyState
          message="Tidak ada data mingguan"
          subMessage="Belum ada data transaksi pada minggu ini"
        />
      )}
    </div>
  );
}

// ── Tab 3: Bulanan ───────────────────────────────────────────────────────────

function BulananTab() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [transactions, setTransactions] = useState<MonthlyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/laporan/bulanan?month=${month}&year=${year}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat laporan bulanan');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, month, year, authHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalTransaksi = transactions.length;
  const totalPenjualan = transactions.reduce((s, t) => s + t.total, 0);
  const rataRata = totalTransaksi > 0 ? Math.round(totalPenjualan / totalTransaksi) : 0;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter Periode</span>
          </div>
          <div className={isMobile ? 'space-y-2' : 'flex items-end gap-3'}>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Bulan</Label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Tahun</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                max="2099"
                className="h-10"
              />
            </div>
            <Button onClick={fetchData} variant="outline" className="gap-2 h-10" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {isMobile ? 'Refresh' : 'Tampilkan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Summary */}
      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="Total Transaksi"
            value={String(totalTransaksi)}
            icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />}
            accentClass="text-blue-700"
            iconBgClass="bg-blue-50 text-blue-600"
          />
          <StatCard
            title="Total Penjualan"
            value={formatRupiah(totalPenjualan)}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            accentClass="text-emerald-700"
            iconBgClass="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            title="Rata-rata per Transaksi"
            value={formatRupiah(rataRata)}
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            accentClass="text-amber-700"
            iconBgClass="bg-amber-50 text-amber-600"
          />
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Detail Transaksi — {monthNames[parseInt(month) - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner />
          ) : transactions.length === 0 ? (
            <EmptyState
              message="Tidak ada data transaksi"
              subMessage={`Belum ada transaksi pada bulan ${monthNames[parseInt(month) - 1]} ${year}`}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[60px] text-center">No</TableHead>
                    <TableHead className="w-[150px]">Invoice</TableHead>
                    <TableHead className="w-[120px]">Tanggal</TableHead>
                    <TableHead className={isMobile ? 'hidden lg:table-cell' : ''}>Kasir</TableHead>
                    <TableHead className={isMobile ? 'hidden md:table-cell' : ''}>Customer</TableHead>
                    <TableHead className={isMobile ? 'hidden sm:table-cell' : ''}>Metode</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, idx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {idx + 1}
                      </TableCell>
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
                      <TableCell className={isMobile ? 'hidden lg:table-cell' : ''}>
                        <span className="text-sm">{tx.user?.name || '-'}</span>
                      </TableCell>
                      <TableCell className={isMobile ? 'hidden md:table-cell' : ''}>
                        <span className="text-sm text-muted-foreground">
                          {tx.customer?.name || 'Umum'}
                        </span>
                      </TableCell>
                      <TableCell className={isMobile ? 'hidden sm:table-cell' : ''}>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${getPaymentBadgeClass(tx.paymentMethod)}`}
                        >
                          {getPaymentLabel(tx.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-blue-700">
                          {formatRupiah(tx.total)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 4: Triwulan ──────────────────────────────────────────────────────────

function TriwulanTab() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const [quarter, setQuarter] = useState(String(currentQuarter));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<QuarterlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/laporan/triwulan?quarter=${quarter}&year=${year}`, authHeaders);
      if (!res.ok) throw new Error('Gagal memuat laporan triwulan');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, quarter, year, authHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const quarterLabels: Record<string, string> = {
    '1': 'Q1 (Jan-Mar)',
    '2': 'Q2 (Apr-Jun)',
    '3': 'Q3 (Jul-Sep)',
    '4': 'Q4 (Okt-Des)',
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter Triwulan</span>
          </div>
          <div className={isMobile ? 'space-y-2' : 'flex items-end gap-3'}>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Triwulan</Label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="1">{quarterLabels['1']}</option>
                <option value="2">{quarterLabels['2']}</option>
                <option value="3">{quarterLabels['3']}</option>
                <option value="4">{quarterLabels['4']}</option>
              </select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Tahun</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                max="2099"
                className="h-10"
              />
            </div>
            <Button onClick={fetchData} variant="outline" className="gap-2 h-10" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {isMobile ? 'Refresh' : 'Tampilkan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Loading */}
      {!error && isLoading && <LoadingSpinner />}

      {/* Content */}
      {!error && !isLoading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Transaksi"
              value={String(data.summary.totalTransactions)}
              icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-blue-700"
              iconBgClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              title="Total Penjualan"
              value={formatRupiah(data.summary.totalPenjualan)}
              icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-emerald-700"
              iconBgClass="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Total Modal"
              value={formatRupiah(data.summary.totalModal)}
              icon={<Receipt className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-red-600"
              iconBgClass="bg-red-50 text-red-500"
            />
            <StatCard
              title="Laba Bersih"
              value={formatRupiah(data.summary.profit)}
              icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-amber-700"
              iconBgClass="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Monthly Breakdown Table */}
          {data.monthlyBreakdown && data.monthlyBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Rincian Bulanan — {quarterLabels[quarter]} {year}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                          <TableHead className="w-[60px] text-center">No</TableHead>
                          <TableHead>Bulan</TableHead>
                          <TableHead className="text-center">Transaksi</TableHead>
                          <TableHead className="text-right">Penjualan</TableHead>
                          <TableHead className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                            Modal
                          </TableHead>
                          <TableHead className="text-right">Laba</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.monthlyBreakdown.map((m, idx) => (
                          <TableRow key={m.month}>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{m.monthName}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {m.totalTransactions}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-emerald-700">
                                {formatRupiah(m.totalPenjualan)}
                              </span>
                            </TableCell>
                            <TableCell className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                              <span className="text-sm text-red-600">
                                {formatRupiah(m.totalModal)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-bold text-blue-700">
                                {formatRupiah(m.profit)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {data.monthlyBreakdown && data.monthlyBreakdown.length === 0 && (
            <EmptyState
              message="Tidak ada data transaksi"
              subMessage={`Belum ada transaksi pada triwulan ${quarterLabels[quarter]} ${year}`}
            />
          )}
        </>
      )}

      {!error && !isLoading && !data && (
        <EmptyState
          message="Tidak ada data triwulan"
          subMessage="Belum ada data transaksi pada triwulan ini"
        />
      )}
    </div>
  );
}

// ── Tab 5: Keuangan ──────────────────────────────────────────────────────────

function KeuanganTab() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  const [startDate, setStartDate] = useState(getFirstDayOfMonthString());
  const [endDate, setEndDate] = useState(getLastDayOfMonthString());
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(
        `/api/laporan/keuangan?startDate=${startDate}&endDate=${endDate}`,
        authHeaders
      );
      if (!res.ok) throw new Error('Gagal memuat laporan keuangan');
      const data = await res.json();
      setFinancialData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setFinancialData(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, startDate, endDate, authHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter Periode</span>
          </div>
          <div className={isMobile ? 'space-y-2' : 'flex items-end gap-3'}>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10"
              />
            </div>
            <Button onClick={fetchData} variant="outline" className="gap-2 h-10" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {isMobile ? 'Refresh' : 'Tampilkan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Summary Cards */}
      {!error && isLoading && <LoadingSpinner />}

      {!error && !isLoading && financialData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Pendapatan"
              value={formatRupiah(financialData.totalPendapatan)}
              icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-emerald-700"
              iconBgClass="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Total Diskon"
              value={formatRupiah(financialData.totalDiskon)}
              icon={<Receipt className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-red-600"
              iconBgClass="bg-red-50 text-red-500"
            />
            <StatCard
              title="Total Pajak"
              value={formatRupiah(financialData.totalPajak)}
              icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-blue-700"
              iconBgClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              title="Laba Kotor"
              value={formatRupiah(financialData.labaKotor)}
              icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
              accentClass="text-amber-700"
              iconBgClass="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Financial Summary Card */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <p className="text-sm font-semibold text-neutral-800">Ringkasan Keuangan</p>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Pendapatan</span>
                  <span className="font-semibold text-emerald-700">
                    {formatRupiah(financialData.totalPendapatan)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Diskon</span>
                  <span className="font-semibold text-red-600">
                    -{formatRupiah(financialData.totalDiskon)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Pajak</span>
                  <span className="font-semibold">{formatRupiah(financialData.totalPajak)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Laba Kotor</span>
                  <span className="font-bold text-blue-700">
                    {formatRupiah(financialData.labaKotor)}
                  </span>
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                * Laba Kotor = Pendapatan - Diskon
              </p>
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          {financialData.dailyBreakdown && financialData.dailyBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Rincian Harian</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                          <TableHead className="w-[60px] text-center">No</TableHead>
                          <TableHead className="w-[120px]">Tanggal</TableHead>
                          <TableHead className="text-right">Pendapatan</TableHead>
                          <TableHead className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                            Diskon
                          </TableHead>
                          <TableHead className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                            Pajak
                          </TableHead>
                          <TableHead className="text-right">Laba Kotor</TableHead>
                          <TableHead className={isMobile ? 'hidden sm:table-cell text-center' : 'text-center'}>
                            Transaksi
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialData.dailyBreakdown.map((day, idx) => (
                          <TableRow key={day.date}>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatDate(day.date)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-emerald-700">
                                {formatRupiah(day.pendapatan)}
                              </span>
                            </TableCell>
                            <TableCell className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                              <span className="text-sm text-red-600">
                                {day.diskon > 0 ? `-${formatRupiah(day.diskon)}` : '-'}
                              </span>
                            </TableCell>
                            <TableCell className={isMobile ? 'hidden md:table-cell text-right' : 'text-right'}>
                              <span className="text-sm text-muted-foreground">
                                {day.pajak > 0 ? formatRupiah(day.pajak) : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-bold text-blue-700">
                                {formatRupiah(day.labaKotor)}
                              </span>
                            </TableCell>
                            <TableCell className={isMobile ? 'hidden sm:table-cell text-center' : 'text-center'}>
                              <Badge variant="secondary" className="text-xs">
                                {day.jumlahTransaksi}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!error && !isLoading && !financialData && (
        <EmptyState
          message="Tidak ada data keuangan"
          subMessage="Belum ada data keuangan pada periode ini"
        />
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function LaporanPage() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  // Permission checks
  const canHarian = usePermission('laporan_harian');
  const canMingguan = usePermission('laporan_mingguan');
  const canBulanan = usePermission('laporan_bulanan');
  const canTriwulan = usePermission('laporan_triwulan');
  const canKeuangan = usePermission('laporan_keuangan');

  // Available tabs based on permissions
  const availableTabs: { key: TabKey; label: string; permission: boolean }[] = [
    { key: 'harian', label: 'Harian', permission: canHarian },
    { key: 'mingguan', label: 'Mingguan', permission: canMingguan },
    { key: 'bulanan', label: 'Bulanan', permission: canBulanan },
    { key: 'triwulan', label: 'Triwulan', permission: canTriwulan },
    { key: 'keuangan', label: 'Laporan Keuangan', permission: canKeuangan },
  ];

  const permittedTabs = availableTabs.filter((t) => t.permission);

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    return permittedTabs.length > 0 ? permittedTabs[0].key : 'harian';
  });

  // If no tabs are permitted, show access denied
  if (permittedTabs.length === 0) {
    return (
      <div className="min-h-screen bg-transparent">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <BarChart3 className="size-5 text-blue-700" />
              </div>
              Laporan & Analitik
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ringkasan performa penjualan dan analitik bisnis
            </p>
          </div>

          {/* Access Denied */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <AlertCircle className="size-12 text-red-400" />
              <p className="text-base font-semibold text-red-700">Akses Ditolak</p>
              <p className="text-sm text-red-600 text-center max-w-md">
                Anda tidak memiliki izin untuk mengakses halaman laporan. Silakan hubungi administrator.
              </p>
            </CardContent>
          </Card>
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
              <BarChart3 className="size-5 text-blue-700" />
            </div>
            Laporan & Analitik
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ringkasan performa penjualan dan analitik bisnis
          </p>
        </div>

        {/* ═══════════════ Tab Bar ═══════════════ */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {permittedTabs.map((tab) => (
            <Button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 gap-2 transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
              size={isMobile ? 'sm' : 'default'}
            >
              {tab.key === 'harian' && <Calendar className="size-4" />}
              {tab.key === 'mingguan' && <CalendarDays className="size-4" />}
              {tab.key === 'bulanan' && <FileText className="size-4" />}
              {tab.key === 'triwulan' && <Layers className="size-4" />}
              {tab.key === 'keuangan' && <DollarSign className="size-4" />}
              {tab.label}
            </Button>
          ))}
        </div>

        {/* ═══════════════ Tab Content ═══════════════ */}
        {activeTab === 'harian' && <HarianTab />}
        {activeTab === 'mingguan' && <MingguanTab />}
        {activeTab === 'bulanan' && <BulananTab />}
        {activeTab === 'triwulan' && <TriwulanTab />}
        {activeTab === 'keuangan' && <KeuanganTab />}
      </div>
    </div>
  );
}
