'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Search,
  Pencil,
  AlertTriangle,
  XCircle,
  Loader2,
  AlertCircle,
  Warehouse,
  TrendingDown,
  X,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string | null;
  categoryId: string;
  category: { id: string; name: string; type: string };
  isActive: boolean;
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

function getStockStatus(stock: number): { label: string; className: string; dotClass: string } {
  if (stock === 0) {
    return {
      label: 'Habis',
      className: 'bg-red-100 text-red-700 border-red-200',
      dotClass: 'bg-red-500',
    };
  }
  if (stock < 10) {
    return {
      label: 'Rendah',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-500',
    };
  }
  if (stock <= 20) {
    return {
      label: 'Sedang',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      dotClass: 'bg-yellow-500',
    };
  }
  return {
    label: 'Aman',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  };
}

// ── Component ──────────────────────────────────────────
export default function StockPage() {
  const { token, user } = useAuthStore();

  // ── Data state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── UI state ──
  const [searchQuery, setSearchQuery] = useState('');

  // ── Edit stock dialog ──
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Delete dialog ──
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Computed ──
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // ── Permission checks ──
  const canEditStock = usePermission('stock_edit');
  const canDeleteStock = usePermission('stock_delete');
  const canAlert = usePermission('stock_alert');
  const isMobile = useIsMobile();

  // ── API Helper ──
  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token]
  );

  // ── Load data ──
  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setIsLoading(true);
      const [productsRes, stockRes] = await Promise.all([
        fetch('/api/products?isActive=true', authHeaders),
        fetch('/api/stock', authHeaders),
      ]);

      if (!productsRes.ok || !stockRes.ok) throw new Error('Gagal memuat data stok');

      const productsData = await productsRes.json();
      const stockData = await stockRes.json();

      setProducts(productsData);
      setLowStockProducts(stockData);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const lowStock = products.filter((p) => p.stock > 0 && p.stock < 10).length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    return { totalProducts, lowStock, outOfStock };
  }, [products]);

  // ── Filtered products ──
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category.name.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  // ── Edit stock ──
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setNewStock(String(product.stock));
    setSubmitError('');
    setShowSuccess(false);
  };

  const handleStockUpdate = async () => {
    if (!editingProduct) return;

    const stockValue = parseInt(newStock, 10);
    if (isNaN(stockValue) || stockValue < 0) {
      setSubmitError('Stok harus berupa angka positif');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setShowSuccess(false);
    try {
      const res = await fetch('/api/stock', {
        method: 'PUT',
        ...authHeaders,
        headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: editingProduct.id, stock: stockValue }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengupdate stok');
      }

      setShowSuccess(true);
      loadData(true);

      // Close dialog after short delay
      setTimeout(() => {
        setEditingProduct(null);
        setShowSuccess(false);
      }, 1000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal mengupdate stok');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete handler ──
  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        ...authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus produk');
      }
      setDeleteTarget(null);
      loadData(true); // Refresh the list silently
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Memuat data stok...</p>
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
                <Warehouse className="size-5 text-blue-700" />
              </div>
              Manajemen Stok
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pantau dan kelola stok produk toko
            </p>
          </div>
          {!isAdmin && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
              Mode Lihat — Hanya admin yang bisa edit stok
            </Badge>
          )}
        </div>

        {/* ═══════════════ Summary Cards ═══════════════ */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-emerald-100 p-2.5">
                <Package className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Produk</p>
                <p className="text-lg sm:text-xl font-bold text-neutral-900">{stats.totalProducts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5">
                <AlertTriangle className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Rendah (&lt;10)</p>
                <p className="text-lg sm:text-xl font-bold text-blue-700">{stats.lowStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-red-100 p-2.5">
                <XCircle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Habis</p>
                <p className="text-lg sm:text-xl font-bold text-red-600">{stats.outOfStock}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════ Low Stock Alert ═══════════════ */}
        {canAlert && lowStockProducts.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-blue-800">
                    Peringatan Stok Rendah
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {lowStockProducts.slice(0, 8).map((p) => (
                      <Badge
                        key={p.id}
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${
                          p.stock === 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {p.name}: {p.stock}
                      </Badge>
                    ))}
                    {lowStockProducts.length > 8 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-neutral-100">
                        +{lowStockProducts.length - 8} lainnya
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ Search ═══════════════ */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk atau kategori..."
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
              <Button variant="outline" size="sm" onClick={loadData} className="ml-auto">
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════ Table ═══════════════ */}
        <Card>
          <CardContent className="p-0">
            {/* Mobile: Card list */}
            <div className="sm:hidden space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="size-10 opacity-30" />
                  <p className="text-sm font-medium">Produk tidak ditemukan</p>
                </div>
              ) : filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product.stock);
                return (
                  <div key={product.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{formatRupiah(product.price)}</p>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 flex items-center gap-1 w-fit mt-1 ${stockStatus.className}`}>
                        <span className={`size-1.5 rounded-full ${stockStatus.dotClass}`} />
                        {product.stock}
                      </Badge>
                    </div>
                    {canEditStock && (
                      <Button variant="ghost" size="icon" className="size-8 text-blue-600 hover:text-blue-700" onClick={() => openEditDialog(product)}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDeleteStock && (
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => { setDeleteTarget(product); setDeleteError(''); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
                    <TableHead className="w-[220px]">Nama Produk</TableHead>
                    <TableHead className="w-[140px]">Kategori</TableHead>
                    <TableHead className="text-right w-[120px]">Harga</TableHead>
                    <TableHead className="text-right w-[100px]">Stok Saat Ini</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="text-right w-[140px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Package className="size-10 opacity-30" />
                          <p className="text-sm font-medium">Produk tidak ditemukan</p>
                          <p className="text-xs">
                            {searchQuery
                              ? 'Tidak ada hasil yang cocok'
                              : 'Belum ada produk aktif'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const stockStatus = getStockStatus(product.stock);
                      return (
                        <TableRow key={product.id} className="group">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {product.category.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm">{formatRupiah(product.price)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                product.stock === 0
                                  ? 'text-red-600'
                                  : product.stock < 10
                                  ? 'text-blue-600'
                                  : product.stock <= 20
                                  ? 'text-yellow-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {product.stock}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 flex items-center gap-1 w-fit ${stockStatus.className}`}
                            >
                              <span className={`size-1.5 rounded-full ${stockStatus.dotClass}`} />
                              {stockStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEditStock && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => openEditDialog(product)}
                                  title="Edit Stok"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              )}
                              {canDeleteStock && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => { setDeleteTarget(product); setDeleteError(''); }}
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                              {!canEditStock && !canDeleteStock && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════ EDIT STOCK DIALOG/DRAWER ═══════════════ */}
      {/* Shared body content */}
      {editingProduct && (() => {
        const bodyContent = (
          <div className="space-y-4 py-2">
            {/* Product info */}
            <div className="bg-neutral-50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">{editingProduct.name}</p>
              <p className="text-xs text-muted-foreground">
                {editingProduct.category.name} • Harga: {formatRupiah(editingProduct.price)}
              </p>
            </div>

            {/* Current stock */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stok saat ini</span>
              <span className="font-semibold">{editingProduct.stock}</span>
            </div>

            {/* New stock input */}
            <div className="space-y-2">
              <Label htmlFor="newStock">Stok Baru</Label>
              <Input
                id="newStock"
                type="number"
                min={0}
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                placeholder="Masukkan jumlah stok baru"
                className={`${isMobile ? 'h-12 text-base' : 'h-11 text-lg'} font-semibold text-center`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStockUpdate();
                }}
              />
            </div>

            {/* Quick stock buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size={isMobile ? 'default' : 'sm'}
                className={`flex-1 ${isMobile ? 'h-12 text-base' : 'text-xs'}`}
                onClick={() => setNewStock(String(editingProduct.stock + 10))}
              >
                +10
              </Button>
              <Button
                variant="outline"
                size={isMobile ? 'default' : 'sm'}
                className={`flex-1 ${isMobile ? 'h-12 text-base' : 'text-xs'}`}
                onClick={() => setNewStock(String(editingProduct.stock + 50))}
              >
                +50
              </Button>
              <Button
                variant="outline"
                size={isMobile ? 'default' : 'sm'}
                className={`flex-1 ${isMobile ? 'h-12 text-base' : 'text-xs'}`}
                onClick={() => setNewStock(String(editingProduct.stock + 100))}
              >
                +100
              </Button>
              <Button
                variant="outline"
                size={isMobile ? 'default' : 'sm'}
                className={`flex-1 ${isMobile ? 'h-12 text-base' : 'text-xs'}`}
                onClick={() => setNewStock('0')}
              >
                0
              </Button>
            </div>

            {/* Success message */}
            {showSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 text-emerald-600 text-sm">
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="font-medium">Stok berhasil diupdate!</span>
              </div>
            )}

            {/* Error message */}
            {submitError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        );

        const footerButtons = (
          <>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Batal
            </Button>
            <Button
              onClick={handleStockUpdate}
              disabled={isSubmitting || showSuccess}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Stok'
              )}
            </Button>
          </>
        );

        const headerTitle = (
          <div className={`flex items-center gap-2 ${isMobile ? 'justify-center' : ''}`}>
            <Warehouse className="size-5 text-blue-600" />
            Edit Stok
          </div>
        );

        const headerDescription = `Ubah stok untuk "${editingProduct.name}"`;

        return isMobile ? (
          <Drawer open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
            <DrawerContent className="max-h-[90dvh] overflow-y-auto">
              <DrawerHeader>
                <DrawerTitle>{headerTitle}</DrawerTitle>
                <DrawerDescription>{headerDescription}</DrawerDescription>
              </DrawerHeader>
              {bodyContent}
              <DrawerFooter className="flex-row gap-2">
                <DrawerClose asChild>
                  <Button variant="outline" className="flex-1">
                    Batal
                  </Button>
                </DrawerClose>
                <Button
                  onClick={handleStockUpdate}
                  disabled={isSubmitting || showSuccess}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Stok'
                  )}
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
            <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]">
              <DialogHeader>
                <DialogTitle>{headerTitle}</DialogTitle>
                <DialogDescription>{headerDescription}</DialogDescription>
              </DialogHeader>
              {bodyContent}
              <DialogFooter className="gap-2">
                {footerButtons}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ═══════════════ DELETE CONFIRMATION DIALOG ═══════════════ */}
      {isMobile ? (
        <Drawer open={!!deleteTarget} onOpenChange={(open) => {
          if (!open && !isDeleting) { setDeleteTarget(null); setDeleteError(''); }
        }}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                Hapus Produk
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600">
                Apakah Anda yakin ingin menghapus produk{' '}
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
              <Button variant="outline" disabled={isDeleting} onClick={() => { setDeleteTarget(null); setDeleteError(''); }} className="h-12">
                Batal
              </Button>
              <Button onClick={handleDeleteProduct} disabled={isDeleting} className="h-12 gap-2 bg-red-500 hover:bg-red-600 text-white">
                {isDeleting && <Loader2 className="size-5 animate-spin" />}
                Ya, Hapus
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => {
          if (!open && !isDeleting) { setDeleteTarget(null); setDeleteError(''); }
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
                Hapus Produk
              </DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin menghapus produk{' '}
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
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteError(''); }} disabled={isDeleting}>
                Batal
              </Button>
              <Button onClick={handleDeleteProduct} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 text-white">
                {isDeleting ? (
                  <><Loader2 className="size-4 animate-spin" /> Memproses...</>
                ) : 'Hapus'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
