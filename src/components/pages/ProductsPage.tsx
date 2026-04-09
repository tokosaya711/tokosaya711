'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/app-store';
import { usePermission } from '@/hooks/use-permission';
import { useIsMobile } from '@/hooks/use-mobile';
import { toImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerHeader,
  DrawerTitle,
  DrawerContent,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { compressImage } from '@/lib/image-compress';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Package,
  Cake,
  UtensilsCrossed,
  Loader2,
  Camera,
  ImageIcon,
  Upload,
  X,
  ShoppingBag,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';

// ─── Upload Button Component (mobile-safe) ───
// Uses opacity-0 + absolute positioning instead of sr-only for better mobile compatibility.
// iOS Safari can block file inputs hidden with clip/overflow.
// The <input type="file"> is a direct child of <label> for native file picker trigger.
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
        style={{ fontSize: '0px' }} // prevent zoom on iOS focus
      />
      <span className="pointer-events-none flex items-center justify-center gap-2 w-full">
        {children}
      </span>
    </label>
  );
}

// ─── Preview Image with local blob fallback ───
// Shows a server-hosted image; falls back to local blob URL if server image fails.
// This handles the case where the server returns the URL but the static file
// isn't immediately available on mobile browsers (Next.js dev static file race).
function PreviewImage({
  src,
  alt,
  className,
  blobUrl,
  onClear,
}: {
  src: string;
  alt: string;
  className?: string;
  blobUrl?: string;
  onClear?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Convert /uploads/ to /api/files/ for reliable serving
  const resolvedSrc = toImageUrl(src);
  const [prevSrc, setPrevSrc] = useState(resolvedSrc);

  // Reset error/loaded state when src changes (derived state pattern)
  if (resolvedSrc !== prevSrc) {
    setPrevSrc(resolvedSrc);
    setImgError(false);
    setLoaded(false);
  }

  // Try server URL first; fall back to blob URL on error
  const displaySrc = (!imgError && resolvedSrc) ? resolvedSrc : (blobUrl || '');

  if (!displaySrc) {
    return null;
  }

  return (
    <div className="relative">
      <img
        src={displaySrc}
        alt={alt}
        className={`${className || ''} ${loaded ? '' : 'animate-pulse bg-gray-100'}`}
        onError={() => setImgError(true)}
        onLoad={() => setLoaded(true)}
      />
      {onClear && (
        <button
          type="button"
          className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-sm active:bg-red-600 z-10"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" />
          Hapus
        </button>
      )}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  price: number;
  capitalPrice: number;
  stock: number;
  image: string | null;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    type: string;
  };
}

interface Category {
  id: string;
  name: string;
  type: string;
  _count?: { products: number };
}

interface ProductFormData {
  name: string;
  categoryId: string;
  price: string;
  capitalPrice: string;
  stock: string;
  isActive: boolean;
  image: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

function SafeImage({ src, alt, className, fallback }: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  // Convert /uploads/ paths to /api/files/ for reliable serving
  const resolvedSrc = toImageUrl(src);

  // Derived state pattern: sync error/loaded with src changes without useEffect
  const [prevSrc, setPrevSrc] = useState(resolvedSrc);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const retryCount = useRef(0);

  if (resolvedSrc !== prevSrc) {
    setPrevSrc(resolvedSrc);
    setError(false);
    setLoaded(false);
  }

  if (!resolvedSrc) {
    return fallback ? <>{fallback}</> : null;
  }
  if (error) {
    return fallback ? <>{fallback}</> : null;
  }
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      crossOrigin="anonymous"
      className={`${className || ''} ${loaded ? '' : 'animate-pulse bg-gray-200'}`}
      onError={() => {
        if (retryCount.current < 2) {
          retryCount.current += 1;
          setError(false);
          // Force reload by appending cache-buster
          setPrevSrc(resolvedSrc + '?retry=' + retryCount.current);
        } else {
          setError(true);
          setLoaded(false);
        }
      }}
      onLoad={() => setLoaded(true)}
    />
  );
}

export default function ProductsPage({ type }: { type: 'cake' | 'food' | 'sembako' }) {
  const isMobile = useIsMobile();
  // ── Permission checks ──
  const canAdd = usePermission(type === 'cake' ? 'cake_add' : type === 'sembako' ? 'sembako_add' : 'food_add');
  const canEdit = usePermission(type === 'cake' ? 'cake_edit' : type === 'sembako' ? 'sembako_edit' : 'food_edit');
  const canDelete = usePermission(type === 'cake' ? 'cake_delete' : type === 'sembako' ? 'sembako_delete' : 'food_delete');
  const canPhoto = usePermission(type === 'cake' ? 'cake_photo' : type === 'sembako' ? 'sembako_photo' : 'food_photo');
  const canPrice = usePermission('product_price');

  const pageTitle = type === 'cake' ? 'Daftar Kue' : type === 'sembako' ? 'Daftar Sembako' : 'Daftar Makanan';
  const addButtonText = type === 'cake' ? 'Tambah Kue' : type === 'sembako' ? 'Tambah Sembako' : 'Tambah Makanan';
  const addDialogTitle = type === 'cake' ? 'Tambah Kue Baru' : type === 'sembako' ? 'Tambah Sembako Baru' : 'Tambah Makanan Baru';
  const categoryLabel = type === 'cake' ? 'Kue' : type === 'sembako' ? 'Sembako' : 'Makanan';
  const editTitle = type === 'cake' ? 'Edit Kue' : type === 'sembako' ? 'Edit Sembako' : 'Edit Makanan';
  const deleteTitle = type === 'cake' ? 'Hapus Kue' : type === 'sembako' ? 'Hapus Sembako' : 'Hapus Makanan';
  const PageIcon = type === 'cake' ? Cake : type === 'sembako' ? ShoppingBag : UtensilsCrossed;

  // ── Data state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  // ── View state ──
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // ── Dialog state ──
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Form state ──
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    categoryId: '',
    price: '',
    capitalPrice: '',
    stock: '',
    isActive: true,
    image: '',
  });
  const [uploading, setUploading] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<string | undefined>(undefined);
  const deletingProductIdRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount or when dialog closes
  useEffect(() => {
    if (!formDialogOpen && previewBlob) {
      URL.revokeObjectURL(previewBlob);
      setPreviewBlob(undefined);
    }
  }, [formDialogOpen, previewBlob]);

  // ── Fetch categories ──
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories?type=${type}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Gagal memuat kategori');
      const data: Category[] = await res.json();
      setCategories(data);
    } catch {
      /* silent */
    }
  }, [type]);

  // ── Fetch products ──
  const fetchProducts = useCallback(
    async (searchQuery?: string, options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('type', type);
        params.set('includeInactive', String(showInactive));
        if (selectedCategoryId && selectedCategoryId !== 'all') {
          params.set('categoryId', selectedCategoryId);
        }
        if (searchQuery?.trim()) {
          params.set('search', searchQuery.trim());
        }
        const res = await fetch(`/api/products?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('Gagal memuat produk');
        const data: Product[] = await res.json();
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    },
    [type, selectedCategoryId, showInactive]
  );

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts(search);
  }, [fetchProducts]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, fetchProducts]);

  // ── Open Add Dialog ──
  const openAddDialog = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      categoryId: categories[0]?.id || '',
      price: '',
      capitalPrice: '',
      stock: '',
      isActive: true,
      image: '',
    });
    setUploading(false);
    if (previewBlob) {
      URL.revokeObjectURL(previewBlob);
      setPreviewBlob(undefined);
    }
    setFormDialogOpen(true);
  };

  // ── Open Edit Dialog ──
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      categoryId: product.categoryId,
      price: String(product.price),
      capitalPrice: String(product.capitalPrice || 0),
      stock: String(product.stock),
      isActive: product.isActive,
      image: product.image || '',
    });
    setUploading(false);
    // Clear previous blob preview when editing existing product
    if (previewBlob) {
      URL.revokeObjectURL(previewBlob);
      setPreviewBlob(undefined);
    }
    setFormDialogOpen(true);
  };

  // ── Open Delete Dialog ──
  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
    deletingProductIdRef.current = product.id;
    setDeleteDialogOpen(true);
  };

  // ── Upload Image (with client-side compression + instant preview) ──
  const uploadFile = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('Ukuran file maksimal 20MB.');
      return;
    }

    // Create local blob URL for instant preview (works immediately on mobile)
    const blobUrl = URL.createObjectURL(file);
    setPreviewBlob(blobUrl);

    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const uploadData = new FormData();
      uploadData.append('file', compressedFile);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: uploadData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      setFormData((prev) => ({ ...prev, image: data.url }));
      // Keep blob URL as fallback for mobile browsers
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengupload foto');
      setPreviewBlob(undefined);
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Save Product ──
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.categoryId || !formData.price) return;
    setSaving(true);
    try {
      const body = {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        price: Number(formData.price),
        capitalPrice: Number(formData.capitalPrice) || 0,
        stock: Number(formData.stock) || 0,
        isActive: formData.isActive,
        image: formData.image || null,
      };

      let res: Response;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/products', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan produk');
      }

      setFormDialogOpen(false);
      fetchProducts(search, { silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Product (soft delete to preserve transaction history) ──
  const handleDelete = async () => {
    // Use ref to survive any state resets from dialog onOpenChange
    const productId = deletingProductIdRef.current;
    if (!productId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal menghapus produk');
      }
      // Immediately remove from local list so it disappears instantly
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setDeleteDialogOpen(false);
      setDeletingProduct(null);
      deletingProductIdRef.current = null;
      fetchProducts(search, { silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render helpers ──
  const renderStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
          Aktif
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200">
        Nonaktif
      </Badge>
    );
  };

  const renderStockBadge = (stock: number, isActive: boolean) => {
    if (!isActive) {
      return <span className="text-gray-400">-</span>;
    }
    if (stock === 0) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
          Habis
        </Badge>
      );
    }
    if (stock <= 10) {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
          {stock}
        </Badge>
      );
    }
    return <span className="font-medium text-gray-700">{stock}</span>;
  };

  const cardColors = [
    'from-blue-400 to-orange-400',
    'from-rose-400 to-pink-400',
    'from-emerald-400 to-teal-400',
    'from-violet-400 to-purple-400',
    'from-sky-400 to-blue-400',
    'from-fuchsia-400 to-pink-400',
    'from-lime-400 to-green-400',
    'from-yellow-400 to-blue-400',
  ];

  const getCardColor = (index: number) =>
    cardColors[index % cardColors.length];

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-orange-500 shadow-sm">
              <PageIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-500">
                {products.length} produk ditemukan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAdd && (
              <Button onClick={openAddDialog} className="gap-2 bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 shadow-sm">
                <Plus className="h-4 w-4" />
                {addButtonText}
              </Button>
            )}
          </div>
        </div>

        {/* ─── Filters & View Toggle ──────────────────────────────── */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-full bg-white sm:w-[200px]">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Tampilkan Nonaktif
            </label>
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={`gap-1.5 ${viewMode === 'table' ? 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white' : 'text-gray-600'}`}
            >
              <List className="h-4 w-4" />
              Tabel
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`gap-1.5 ${viewMode === 'grid' ? 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white' : 'text-gray-600'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
          </div>
        </div>

        {/* ─── Error State ────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={() => fetchProducts(search)}
              className="ml-2 text-red-700"
            >
              Coba lagi
            </Button>
          </div>
        )}

        {/* ─── Loading Skeleton ───────────────────────────────────────── */}
        {loading && viewMode === 'table' && <TableSkeleton />}
        {loading && viewMode === 'grid' && <GridSkeleton />}

        {/* ─── Empty State ────────────────────────────────────────────── */}
        {!loading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Package className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Produk tidak ditemukan
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              {search || selectedCategoryId !== 'all'
                ? 'Coba ubah filter pencarian Anda.'
                : categories.length === 0
                  ? 'Belum ada kategori. Buat kategori terlebih dahulu sebelum menambahkan produk.'
                  : 'Belum ada produk yang ditambahkan.'}
            </p>
            {canAdd && !search && selectedCategoryId === 'all' && categories.length === 0 && (
              <Button
                onClick={() => useAppStore.getState().setCurrentPage('categories')}
                className="gap-2 bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600"
              >
                <FolderOpen className="h-4 w-4" />
                Buat Kategori Dulu
              </Button>
            )}
            {canAdd && !search && selectedCategoryId === 'all' && categories.length > 0 && (
              <Button
                onClick={openAddDialog}
                className="gap-2 bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600"
              >
                <Plus className="h-4 w-4" />
                {addButtonText}
              </Button>
            )}
          </div>
        )}

        {/* ─── Table View ─────────────────────────────────────────────── */}
        {!loading && !error && products.length > 0 && viewMode === 'table' && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="w-[70px] text-center">Foto</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Harga Jual</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Harga Modal</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Untung</TableHead>
                    <TableHead className="text-center">Stok</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Status</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="w-[120px] text-center">Aksi</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow
                      key={product.id}
                      className={`group transition-colors ${!product.isActive ? 'opacity-60' : ''} hover:bg-blue-50/50`}
                    >
                      <TableCell className="text-center">
                        <SafeImage
                          src={product.image || ''}
                          alt={product.name}
                          className="h-10 w-10 rounded-md object-cover mx-auto border border-gray-200"
                          fallback={
                            <div className={`flex h-10 w-10 mx-auto items-center justify-center rounded-md bg-gradient-to-br ${getCardColor(0)} shadow-sm`}>
                              <Package className="h-4 w-4 text-white/80" />
                            </div>
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-900">
                          {product.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {product.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-gray-900">
                        {formatRupiah(product.price)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell text-gray-500">
                        {formatRupiah(product.capitalPrice || 0)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        <span className="flex items-center justify-end gap-1 font-semibold text-emerald-600">
                          <TrendingUp className="size-3" />
                          {formatRupiah((product.price || 0) - (product.capitalPrice || 0))}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {renderStockBadge(product.stock, product.isActive)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderStatusBadge(product.isActive)}
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => openEditDialog(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            )}
                            {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => openDeleteDialog(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ─── Grid View ────────────────────────────────────────────── */}
        {!loading && !error && products.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {products.map((product, index) => (
              <Card
                key={product.id}
                className={`group overflow-hidden rounded-lg transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${!product.isActive ? 'opacity-60' : ''}`}
              >
                {/* Image */}
                <div
                  className={`relative aspect-square bg-gradient-to-br ${getCardColor(index)} overflow-hidden`}
                >
                  <SafeImage
                    src={product.image || ''}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    fallback={<Package className="h-12 w-12 text-white/80" />}
                  />
                  {/* Status & stock overlay */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {renderStatusBadge(product.isActive)}
                  </div>
                  <div className="absolute top-3 left-3">
                    {renderStockBadge(product.stock, product.isActive)}
                  </div>
                  {/* Admin actions — always visible on mobile, hover on desktop */}
                  {(canEdit || canDelete) && (
                    <div className="absolute bottom-3 right-3 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 bg-white/90 text-gray-700 hover:bg-white hover:text-blue-600 shadow-sm"
                        onClick={() => openEditDialog(product)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      )}
                      {canDelete && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 bg-white/90 text-gray-700 hover:bg-white hover:text-red-600 shadow-sm"
                        onClick={() => openDeleteDialog(product)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      )}
                    </div>
                  )}
                </div>
                <CardContent className="p-2.5 sm:p-4">
                  <div className="mb-1 sm:mb-2">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {product.category.name}
                    </Badge>
                  </div>
                  <h3 className="mb-1 text-sm sm:text-base font-semibold text-gray-900 line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-sm sm:text-lg font-bold text-blue-700">
                    {formatRupiah(product.price)}
                  </p>
                  {product.stock > 0 && product.isActive && (
                    <p className="mt-0.5 text-[10px] sm:text-xs text-gray-400">
                      Stok: {product.stock} unit
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── Add/Edit Product Form (Dialog for all screen sizes) ─── */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-1rem)] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingProduct ? (
                <>
                  <Pencil className="h-5 w-5 text-blue-500" />
                  {editTitle}
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-blue-500" />
                  {addDialogTitle}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Foto {categoryLabel} */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
              <div className="px-4 pt-3 pb-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Foto {categoryLabel}</Label>
              </div>
              <div className="px-4 pb-3">
              {(formData.image || previewBlob) ? (
                <div className="space-y-2">
                  <PreviewImage
                    src={formData.image || ''}
                    alt={`Foto ${categoryLabel.toLowerCase()}`}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                    blobUrl={previewBlob}
                    onClear={canPhoto ? () => {
                      setFormData((prev) => ({ ...prev, image: '' }));
                      if (previewBlob) {
                        URL.revokeObjectURL(previewBlob);
                        setPreviewBlob(undefined);
                      }
                    } : undefined}
                  />
                  {canPhoto && (
                    <div className="flex gap-2">
                      <FileUploadButton
                        onFileSelect={uploadFile}
                        className="gap-1.5 flex-1 h-9 rounded-lg border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Ganti Foto {categoryLabel}
                      </FileUploadButton>
                      <FileUploadButton
                        onFileSelect={uploadFile}
                        capture="environment"
                        className="gap-1.5 flex-1 h-9 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Kamera
                      </FileUploadButton>
                    </div>
                  )}
                </div>
              ) : canPhoto ? (
                <div className="space-y-2">
                  {uploading ? (
                    <div className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50">
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-2" />
                      <span className="text-sm font-medium text-blue-600">Mengupload...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <FileUploadButton
                        onFileSelect={uploadFile}
                        className="h-16 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 flex-col gap-1 text-xs font-medium text-blue-600 hover:bg-blue-100 cursor-pointer"
                      >
                        <Upload className="h-5 w-5" />
                        <span>Pilih File</span>
                      </FileUploadButton>
                      <FileUploadButton
                        onFileSelect={uploadFile}
                        capture="environment"
                        className="h-16 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/50 flex-col gap-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                      >
                        <Camera className="h-5 w-5" />
                        <span>Kamera</span>
                      </FileUploadButton>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 h-16 rounded-lg bg-gray-100/50">
                  <ImageIcon className="h-5 w-5 text-gray-300" />
                  <span className="text-xs text-gray-400">Upload foto {categoryLabel.toLowerCase()} tidak diizinkan</span>
                </div>
              )}
              </div>
            </div>

            {/* Nama Produk */}
            <div className="grid gap-1.5">
              <Label htmlFor="product-name" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nama Produk *</Label>
              <Input
                id="product-name"
                placeholder="Masukkan nama produk"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            {/* Kategori & Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Kategori *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, categoryId: val }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editingProduct && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</Label>
                  <Select
                    value={formData.isActive ? 'active' : 'inactive'}
                    onValueChange={(val) =>
                      setFormData((prev) => ({
                        ...prev,
                        isActive: val === 'active',
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="inactive">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Harga & Stok */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="product-price" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{canPrice ? 'Harga Jual (Rp) *' : 'Harga Jual (Rp) 🔒'}</Label>
                <Input
                  id="product-price"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  min="0"
                  disabled={!canPrice}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="product-capital" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Harga Modal (Rp)</Label>
                <Input
                  id="product-capital"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={formData.capitalPrice}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, capitalPrice: e.target.value }))
                  }
                  min="0"
                  disabled={!canPrice}
                />
              </div>
            </div>

            {/* Stok */}
            <div className="grid gap-1.5">
              <Label htmlFor="product-stock" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stok</Label>
              <Input
                id="product-stock"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={formData.stock}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, stock: e.target.value }))
                }
                min="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFormDialogOpen(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !formData.name.trim() ||
                !formData.categoryId ||
                !formData.price
              }
              className="gap-2 bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingProduct ? 'Simpan Perubahan' : addButtonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation (Drawer on mobile, Dialog on desktop) ─── */}
      {isMobile ? (
        <Drawer open={deleteDialogOpen} onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteDialogOpen(false);
            setDeletingProduct(null);
            deletingProductIdRef.current = null;
          }
        }}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                {deleteTitle}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600">
                Apakah Anda yakin ingin menghapus {categoryLabel.toLowerCase()}{' '}
                <span className="font-semibold text-gray-900">
                  &quot;{deletingProduct?.name}&quot;
                </span>
                {' '}dari sistem?
              </p>
            </div>
            <DrawerFooter className="gap-2">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  if (!deleting) {
                    setDeleteDialogOpen(false);
                    setDeletingProduct(null);
                    deletingProductIdRef.current = null;
                  }
                }}
                className="h-12"
              >
                Batal
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="h-12 gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                {deleting && <Loader2 className="h-5 w-5 animate-spin" />}
                Ya, Hapus
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteDialogOpen(false);
            setDeletingProduct(null);
            deletingProductIdRef.current = null;
          }
        }}>
          <DialogContent
            className="sm:max-w-md"
            onPointerDownOutside={(e) => { if (deleting) e.preventDefault(); }}
            onInteractOutside={(e) => { if (deleting) e.preventDefault(); }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                {deleteTitle}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus {categoryLabel.toLowerCase()}{' '}
              <span className="font-semibold text-gray-900">
                &quot;{deletingProduct?.name}&quot;
              </span>
              {' '}dari sistem? {categoryLabel} yang sudah dihapus tidak dapat dikembalikan.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!deleting) {
                    setDeleteDialogOpen(false);
                    setDeletingProduct(null);
                    deletingProductIdRef.current = null;
                  }
                }}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleting}
                className="gap-2 bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Ya, Hapus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


    </div>
  );
}

// ─── Table Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
            <TableHead className="w-[70px]">Foto</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead className="text-right">Harga Jual</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Harga Modal</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Untung</TableHead>
            <TableHead className="text-center">Stok</TableHead>
            <TableHead className="text-center hidden lg:table-cell">Status</TableHead>
            <TableHead className="w-[120px] text-center">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow
              key={i}
              className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
            >
              <TableCell>
                <Skeleton className="mx-auto h-10 w-10 rounded-lg" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-24" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="mx-auto h-5 w-10 rounded-full" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="mx-auto h-5 w-14 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex justify-center gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Grid Skeleton ──────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden rounded-lg">
          <Skeleton className="aspect-square w-full" />
          <CardContent className="p-2.5 sm:p-4 space-y-3">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-6 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
