'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  BarChart3,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePermission } from '@/hooks/use-permission';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardData {
  todaySales: number;
  todayTransactions: number;
  todayProducts: number;
  bestSellers: { name: string; total: number; revenue: number }[];
  dailySales: { date: string; total: number }[];
}

interface RecentTransaction {
  id: string;
  invoiceNumber: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  user: { id: string; name: string } | null;
}

// ── Stat Card Skeleton ─────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card className="p-3 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1.5 sm:space-y-2">
          <Skeleton className="h-3 w-20 sm:h-4 sm:w-28" />
          <Skeleton className="h-5 w-24 sm:h-7 sm:w-36" />
        </div>
        <Skeleton className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl shrink-0" />
      </div>
    </Card>
  );
}

// ── Chart Skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <Card className="p-3 sm:p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-sm sm:text-base font-semibold">Penjualan 7 Hari Terakhir</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Skeleton className="h-[180px] sm:h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ── Best Sellers Skeleton ──────────────────────────────────────────────────

function BestSellersSkeleton() {
  return (
    <Card className="p-3 sm:p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-sm sm:text-base font-semibold">Produk Terlaris</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-3">
              <Skeleton className="h-6 w-6 sm:h-7 sm:w-7 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                <Skeleton className="h-2.5 sm:h-3 w-16 sm:w-20" />
              </div>
              <Skeleton className="h-3 sm:h-4 w-16 sm:w-20 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Recent Transactions Skeleton ───────────────────────────────────────────

function RecentTransactionsSkeleton() {
  return (
    <Card className="p-3 sm:p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-sm sm:text-base font-semibold">Transaksi Terakhir</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="space-y-2 sm:space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
              <Skeleton className="h-3 sm:h-4 w-14 sm:w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Custom Tooltip for Chart ───────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  let formattedDate = label;
  try {
    formattedDate = format(parseISO(label!), 'EEE, dd MMM', { locale: idLocale });
  } catch {
    // keep original label
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{formattedDate}</p>
      <p className="text-sm font-semibold text-blue-700">
        {formatRupiah(payload[0].value)}
      </p>
    </div>
  );
}

// ── Stat Card Component ────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accentClass: string;
  iconBgClass: string;
  onClick?: () => void;
}

function StatCard({ title, value, icon, accentClass, iconBgClass, onClick }: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`p-3 sm:p-6 transition-all duration-200 min-w-0 overflow-hidden cursor-pointer active:scale-[0.97] hover:shadow-lg hover:-translate-y-0.5 ${onClick ? 'hover:bg-accent/30' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5 sm:space-y-1">
          <p className="text-[11px] sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className={`text-sm sm:text-2xl font-bold tracking-tight ${accentClass} truncate`}>{value}</p>
        </div>
        <div className={`flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${iconBgClass} transition-transform duration-200 ${onClick ? 'group-hover:scale-110' : ''}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Main Dashboard Page ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statPopup, setStatPopup] = useState<string | null>(null);

  // ── Permission checks ──
  const canViewStats = usePermission('dashboard_stats');
  const canViewBestSeller = usePermission('dashboard_best_seller');
  const canViewRecentTx = usePermission('dashboard_recent_tx');

  useEffect(() => {
    async function fetchData() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [dashboardRes, transactionsRes] = await Promise.all([
          fetch('/api/dashboard', { headers }),
          fetch('/api/transactions?limit=5', { headers }),
        ]);

        if (!dashboardRes.ok || !transactionsRes.ok) {
          throw new Error('Gagal memuat data dashboard');
        }

        const dashboardData = await dashboardRes.json();
        const transactionsData = await transactionsRes.json();

        setDashboard(dashboardData);
        setRecentTransactions(transactionsData.transactions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  // ── Error State ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      </div>
    );
  }

  // ── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-6 overflow-x-hidden">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        {/* Middle row */}
        <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartSkeleton />
          </div>
          <div>
            <BestSellersSkeleton />
          </div>
        </div>
        {/* Bottom row */}
        <RecentTransactionsSkeleton />
      </div>
    );
  }

  if (!dashboard) return null;

  // ── Computed Values ─────────────────────────────────────────────────────

  const avgPerTransaction =
    dashboard.todayTransactions > 0
      ? Math.round(dashboard.todaySales / dashboard.todayTransactions)
      : 0;

  // Format daily sales data for chart
  const chartData = dashboard.dailySales.map((item) => ({
    ...item,
    label: (() => {
      try {
        return format(parseISO(item.date), 'EEE, dd MMM', { locale: idLocale });
      } catch {
        return item.date;
      }
    })(),
  }));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 sm:space-y-6 overflow-x-hidden">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
          Ringkasan penjualan & aktivitas toko hari ini
        </p>
      </div>

      {/* ── Permission denied message ──────────────────────────────────── */}
      {!canViewStats && !canViewBestSeller && !canViewRecentTx && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Anda tidak memiliki akses untuk melihat data dashboard.</p>
        </Card>
      )}

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      {canViewStats && (
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Penjualan Hari Ini"
          value={formatRupiah(dashboard.todaySales)}
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          accentClass="text-emerald-600"
          iconBgClass="bg-emerald-50 text-emerald-600"
          onClick={() => setStatPopup('sales')}
        />
        <StatCard
          title="Total Transaksi"
          value={String(dashboard.todayTransactions)}
          icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />}
          accentClass="text-blue-600"
          iconBgClass="bg-blue-50 text-blue-600"
          onClick={() => setStatPopup('transactions')}
        />
        <StatCard
          title="Produk Terjual"
          value={String(dashboard.todayProducts)}
          icon={<Package className="h-4 w-4 sm:h-5 sm:w-5" />}
          accentClass="text-purple-600"
          iconBgClass="bg-purple-50 text-purple-600"
          onClick={() => setStatPopup('products')}
        />
        <StatCard
          title="Rata-rata / Transaksi"
          value={formatRupiah(avgPerTransaction)}
          icon={<BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />}
          accentClass="text-teal-600"
          iconBgClass="bg-teal-50 text-teal-600"
          onClick={() => setStatPopup('average')}
        />
      </div>
      )}

      {/* ── Middle Row: Chart + Best Sellers ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <Card className="p-3 sm:p-6 lg:col-span-2 min-w-0 overflow-hidden">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-sm sm:text-base font-semibold">
              Penjualan 7 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="h-[180px] sm:h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#888888' }}
                    axisLine={{ stroke: '#e5e5e5' }}
                    tickLine={false}
                    dy={6}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#888888' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val: number) =>
                      val >= 1000000
                        ? `${(val / 1000000).toFixed(1)}jt`
                        : val >= 1000
                          ? `${(val / 1000).toFixed(0)}rb`
                          : String(val)
                    }
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                    dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                    activeDot={{
                      fill: '#f59e0b',
                      strokeWidth: 2,
                      stroke: '#fff',
                      r: 5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Best Sellers */}
        {canViewBestSeller && (
        <Card className="p-3 sm:p-6 min-w-0 overflow-hidden">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-sm sm:text-base font-semibold">
              Produk Terlaris
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {dashboard.bestSellers.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">Belum ada data penjualan hari ini</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {dashboard.bestSellers.map((product, index) => (
                  <div
                    key={product.name}
                    className="flex items-center gap-2 sm:gap-3 rounded-lg px-1 sm:px-2 py-1.5 sm:py-2 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${
                        index === 0
                          ? 'bg-blue-100 text-blue-700'
                          : index === 1
                            ? 'bg-orange-100 text-orange-700'
                            : index === 2
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground">
                        {product.total} terjual
                      </p>
                    </div>
                    <p className="shrink-0 text-xs sm:text-sm font-semibold text-foreground">
                      {formatRupiah(product.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* ── Bottom Row: Recent Transactions ─────────────────────────────── */}
      {canViewRecentTx && (
      <Card className="p-3 sm:p-6 min-w-0 overflow-hidden">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-sm sm:text-base font-semibold">
            Transaksi Terakhir
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {recentTransactions.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
            </div>
          ) : (
            <>
              {/* Mobile: Card list */}
              <div className="sm:hidden space-y-2">
                {recentTransactions.map((tx) => {
                  let formattedDate = '';
                  try {
                    formattedDate = format(parseISO(tx.createdAt), 'dd MMM, HH:mm', { locale: idLocale });
                  } catch { formattedDate = tx.createdAt; }

                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-lg border bg-card p-2.5 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{tx.user?.name || '-'}</p>
                        <p className="text-[11px] text-muted-foreground">{formattedDate}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-emerald-600">{formatRupiah(tx.total)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-3">Waktu</TableHead>
                      <TableHead>Kasir</TableHead>
                      <TableHead className="pr-3 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map((tx) => {
                      let formattedDate = '';
                      try {
                        formattedDate = format(parseISO(tx.createdAt), 'dd MMM, HH:mm', {
                          locale: idLocale,
                        });
                      } catch {
                        formattedDate = tx.createdAt;
                      }

                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="pl-3 text-muted-foreground">
                            {formattedDate}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {tx.user?.name || '-'}
                          </TableCell>
                          <TableCell className="pr-3 text-right font-semibold text-blue-700">
                            {formatRupiah(tx.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* ═══════════════ Stat Card Popups ═══════════════ */}
      <Dialog open={!!statPopup} onOpenChange={(open) => { if (!open) setStatPopup(null); }}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {statPopup === 'sales' && '📈 Penjualan Hari Ini'}
              {statPopup === 'transactions' && '🛒 Detail Total Transaksi'}
              {statPopup === 'products' && '📦 Detail Produk Terjual'}
              {statPopup === 'average' && '📊 Rata-rata per Transaksi'}
            </DialogTitle>
            <DialogDescription>
              {statPopup === 'sales' && 'Ringkasan penjualan toko hari ini'}
              {statPopup === 'transactions' && 'Daftar semua transaksi hari ini'}
              {statPopup === 'products' && 'Daftar produk yang terjual hari ini'}
              {statPopup === 'average' && 'Analisis rata-rata nilai per transaksi'}
            </DialogDescription>
          </DialogHeader>

          {/* Penjualan Hari Ini */}
          {statPopup === 'sales' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-4 text-center">
                  <p className="text-xs text-emerald-600 font-medium">Total Penjualan</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatRupiah(dashboard.todaySales)}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 text-center">
                  <p className="text-xs text-blue-600 font-medium">Jumlah Transaksi</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{dashboard.todayTransactions}</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-4 text-center">
                  <p className="text-xs text-purple-600 font-medium">Produk Terjual</p>
                  <p className="text-xl font-bold text-purple-700 mt-1">{dashboard.todayProducts}</p>
                </div>
                <div className="rounded-xl bg-teal-50 p-4 text-center">
                  <p className="text-xs text-teal-600 font-medium">Rata-rata / Transaksi</p>
                  <p className="text-xl font-bold text-teal-700 mt-1">{formatRupiah(avgPerTransaction)}</p>
                </div>
              </div>
              {dashboard.bestSellers.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Produk Terlaris Hari Ini</p>
                  <div className="space-y-2">
                    {dashboard.bestSellers.slice(0, 5).map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">{i + 1}</span>
                          <span className="text-sm font-medium">{p.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-emerald-600">{formatRupiah(p.revenue)}</p>
                          <p className="text-[10px] text-muted-foreground">{p.total} terjual</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Total Transaksi */}
          {statPopup === 'transactions' && (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">Total Transaksi Hari Ini</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{dashboard.todayTransactions}</p>
              </div>
              {recentTransactions.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {recentTransactions.map((tx) => {
                    let formattedDate = '';
                    try { formattedDate = format(parseISO(tx.createdAt), 'HH:mm', { locale: idLocale }); } catch { formattedDate = tx.createdAt; }
                    return (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 active:scale-[0.98] transition-transform">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{tx.invoiceNumber}</p>
                          <p className="text-[11px] text-muted-foreground">{tx.user?.name || '-'} · {formattedDate}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-emerald-600">{formatRupiah(tx.total)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada transaksi hari ini</p>
              )}
            </div>
          )}

          {/* Produk Terjual */}
          {statPopup === 'products' && (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl bg-purple-50 p-3 text-center">
                <p className="text-xs text-purple-600 font-medium">Total Produk Terjual</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{dashboard.todayProducts}</p>
              </div>
              {dashboard.bestSellers.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {dashboard.bestSellers.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between rounded-lg border px-3 py-2.5 active:scale-[0.98] transition-transform">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">{i + 1}</span>
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-purple-600">{p.total} pcs</p>
                        <p className="text-[10px] text-muted-foreground">{formatRupiah(p.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada produk terjual hari ini</p>
              )}
            </div>
          )}

          {/* Rata-rata / Transaksi */}
          {statPopup === 'average' && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-teal-50 p-4 text-center">
                <p className="text-xs text-teal-600 font-medium">Rata-rata per Transaksi</p>
                <p className="text-2xl font-bold text-teal-700 mt-1">{formatRupiah(avgPerTransaction)}</p>
                <p className="text-[11px] text-teal-500 mt-1">{dashboard.todayTransactions} transaksi hari ini</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Distribusi Penjualan</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <span className="text-sm">Total Penjualan</span>
                    <span className="text-sm font-bold text-emerald-600">{formatRupiah(dashboard.todaySales)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <span className="text-sm">Jumlah Transaksi</span>
                    <span className="text-sm font-bold text-blue-600">{dashboard.todayTransactions}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <span className="text-sm">Produk Terjual</span>
                    <span className="text-sm font-bold text-purple-600">{dashboard.todayProducts}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <span className="text-sm">Rata-rata Produk/Tx</span>
                    <span className="text-sm font-bold text-amber-600">
                      {dashboard.todayTransactions > 0 ? (dashboard.todayProducts / dashboard.todayTransactions).toFixed(1) : '0'} pcs
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
