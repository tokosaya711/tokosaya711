'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/use-permission';
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Plus,
  FolderTree,
  Pencil,
  Trash2,
  Cake,
  UtensilsCrossed,
  ShoppingBag,
  Loader2,
  Search,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  _count?: { products: number };
}

interface CategoryFormData {
  name: string;
  type: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const canAddCatCake = usePermission('category_add_cake');
  const canAddCatFood = usePermission('category_add_food');
  const canAddCatSembako = usePermission('category_add_sembako');
  const canEditCatCake = usePermission('category_edit_cake');
  const canEditCatFood = usePermission('category_edit_food');
  const canEditCatSembako = usePermission('category_edit_sembako');
  const canDeleteCatCake = usePermission('category_delete_cake');
  const canDeleteCatFood = usePermission('category_delete_food');
  const canDeleteCatSembako = usePermission('category_delete_sembako');
  const canAddCategory = canAddCatCake || canAddCatFood || canAddCatSembako;
  const canEdit = canEditCatCake || canEditCatFood || canEditCatSembako;
  const canDelete = canDeleteCatCake || canDeleteCatFood || canDeleteCatSembako;
  const canAccessCakes = usePermission('cakes');
  const canAccessFoods = usePermission('foods');
  const canAccessSembako = usePermission('sembako');

  // ── Allowed types based on role permissions ──
  const allowedTypes = [
    ...(canAccessCakes ? ['cake'] as const : []),
    ...(canAccessFoods ? ['food'] as const : []),
    ...(canAccessSembako ? ['sembako'] as const : []),
  ];

  // ── Default type for add form (first allowed type) ──
  const defaultType = allowedTypes[0] || 'cake';

  // ── Data state ──
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // ── Dialog state ──
  const isMobile = useIsMobile();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Form state ──
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    type: 'cake',
  });

  // ── Fetch categories ──
  const fetchCategories = useCallback(async (searchQuery?: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType && filterType !== 'all') {
        params.set('type', filterType);
      }
      const res = await fetch(`/api/categories?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Gagal memuat kategori');
      const data: Category[] = await res.json();
      // Filter to only allowed types based on permissions
      setCategories(data.filter((c) => allowedTypes.includes(c.type)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [filterType, allowedTypes]);

  useEffect(() => {
    fetchCategories(search);
  }, [fetchCategories]);

  // ── Filtered categories (client-side search) ──
  const filteredCategories = categories.filter((cat) => {
    if (!search.trim()) return true;
    return cat.name.toLowerCase().includes(search.toLowerCase());
  });

  // ── Stats ──
  const totalCategories = categories.length;
  const cakeCategories = canAccessCakes ? categories.filter((c) => c.type === 'cake').length : 0;
  const foodCategories = canAccessFoods ? categories.filter((c) => c.type === 'food').length : 0;
  const sembakoCategories = canAccessSembako ? categories.filter((c) => c.type === 'sembako').length : 0;
  const totalProducts = categories.reduce((sum, c) => sum + (c._count?.products || 0), 0);
  const hasMultipleTypes = allowedTypes.length > 1;

  // ── Open Add Dialog ──
  const openAddDialog = () => {
    setEditingCategory(null);
    setFormData({ name: '', type: defaultType });
    setFormDialogOpen(true);
  };

  // ── Open Edit Dialog ──
  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, type: category.type });
    setFormDialogOpen(true);
  };

  // ── Open Delete Dialog ──
  const openDeleteDialog = (category: Category) => {
    setDeletingCategory(category);
    setDeleteError(null);
  };

  // ── Save Category ──
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.type) return;
    setSaving(true);
    try {
      const body = {
        name: formData.name.trim(),
        type: formData.type,
      };

      let res: Response;
      if (editingCategory) {
        res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/categories', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan kategori');
      }

      setFormDialogOpen(false);
      fetchCategories(search, true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Category ──
  const handleDelete = async () => {
    if (!deletingCategory) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus kategori');
      }
      setDeletingCategory(null);
      fetchCategories(search, true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setDeleting(false);
    }
  };

  const typeIcon = (type: string) => {
    if (type === 'cake') return <Cake className="h-4 w-4" />;
    if (type === 'food') return <UtensilsCrossed className="h-4 w-4" />;
    return <ShoppingBag className="h-4 w-4" />;
  };

  const typeBadgeClass = (type: string) => {
    if (type === 'cake') return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100';
    if (type === 'food') return 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
    return 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100';
  };

  const typeLabel = (type: string) => {
    if (type === 'cake') return 'Kue';
    if (type === 'food') return 'Makanan';
    return 'Sembako';
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <FolderTree className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kategori</h1>
              <p className="text-sm text-gray-500">
                {totalCategories} kategori ditemukan
              </p>
            </div>
          </div>
          {canAddCategory && (
            <Button onClick={openAddDialog} className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-sm">
              <Plus className="h-4 w-4" />
              Tambah Kategori
            </Button>
          )}
        </div>

        {/* ─── Stats Cards ──────────────────────────────────── */}
        <div className={`grid gap-3 sm:gap-4 mb-4 sm:mb-6 ${hasMultipleTypes ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-violet-100">
                <FolderTree className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Total Kategori</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalCategories}</p>
              </div>
            </CardContent>
          </Card>
          {canAccessCakes && (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-blue-100">
                <Cake className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Kategori Kue</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{cakeCategories}</p>
              </div>
            </CardContent>
          </Card>
          )}
          {canAccessFoods && (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-emerald-100">
                <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Kategori Makanan</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{foodCategories}</p>
              </div>
            </CardContent>
          </Card>
          )}
          {canAccessSembako && (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-orange-100">
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Kategori Sembako</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{sembakoCategories}</p>
              </div>
            </CardContent>
          </Card>
          )}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-sky-100">
                <FolderTree className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Total Produk</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalProducts}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Filters ──────────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Cari kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          {hasMultipleTypes && (
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full bg-white sm:w-[180px]">
              <SelectValue placeholder="Semua Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {canAccessCakes && <SelectItem value="cake">Kue</SelectItem>}
              {canAccessFoods && <SelectItem value="food">Makanan</SelectItem>}
              {canAccessSembako && <SelectItem value="sembako">Sembako</SelectItem>}
            </SelectContent>
          </Select>
          )}
        </div>

        {/* ─── Error State ──────────────────────────────────── */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={() => fetchCategories(search)}
              className="ml-2 text-red-700"
            >
              Coba lagi
            </Button>
          </div>
        )}

        {/* ─── Loading Skeleton ─────────────────────────────── */}
        {loading && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead>Nama Kategori</TableHead>
                  <TableHead className="text-center">Tipe</TableHead>
                  <TableHead className="text-center">Jumlah Produk</TableHead>
                  <TableHead className="w-[120px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10 rounded-full mx-auto" /></TableCell>
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
        )}

        {/* ─── Empty State ──────────────────────────────────── */}
        {!loading && !error && filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-50">
              <FolderTree className="h-8 w-8 text-violet-400" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Kategori tidak ditemukan
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              {search || filterType !== 'all'
                ? 'Coba ubah filter pencarian Anda.'
                : 'Belum ada kategori yang ditambahkan.'}
            </p>
            {canAddCategory && !search && filterType === 'all' && (
              <Button
                onClick={openAddDialog}
                className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                <Plus className="h-4 w-4" />
                Tambah Kategori
              </Button>
            )}
          </div>
        )}

        {/* ─── Table ────────────────────────────────────────── */}
        {!loading && !error && filteredCategories.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead>Nama Kategori</TableHead>
                    <TableHead className="text-center">Tipe</TableHead>
                    <TableHead className="text-center">Jumlah Produk</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Dibuat</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="w-[120px] text-center">Aksi</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category, index) => (
                    <TableRow
                      key={category.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-violet-50/50 transition-colors`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${category.type === 'cake' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                            {typeIcon(category.type)}
                          </div>
                          <span className="font-medium text-gray-900">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={typeBadgeClass(category.type)}>
                          {typeLabel(category.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-medium">
                          {category._count?.products || 0} produk
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <span className="text-sm text-gray-500">
                          {new Date(category.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-violet-600 hover:bg-violet-50"
                                onClick={() => openEditDialog(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => openDeleteDialog(category)}
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
      </div>

      {/* ─── Add/Edit Category Dialog/Drawer ────────────────────── */}
      {isMobile ? (
        <Drawer open={formDialogOpen} onOpenChange={setFormDialogOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle className="flex items-center gap-2">
                {editingCategory ? (
                  <>
                    <Pencil className="h-5 w-5 text-violet-500" />
                    Edit Kategori
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-violet-500" />
                    Tambah Kategori Baru
                  </>
                )}
              </DrawerTitle>
            </DrawerHeader>
            <div className="grid gap-4 px-4 pb-4">
              {/* Nama Kategori */}
              <div className="grid gap-2">
                <Label htmlFor="category-name-mobile">Nama Kategori</Label>
                <Input
                  id="category-name-mobile"
                  placeholder="Masukkan nama kategori"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="h-12 text-base"
                />
              </div>

              {/* Tipe */}
              <div className="grid gap-2">
                <Label>Tipe</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, type: val }))
                  }
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {canAccessCakes && (
                    <SelectItem value="cake">
                      <span className="flex items-center gap-2">
                        <Cake className="h-4 w-4" />
                        Kue
                      </span>
                    </SelectItem>
                    )}
                    {canAccessFoods && (
                    <SelectItem value="food">
                      <span className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        Makanan
                      </span>
                    </SelectItem>
                    )}
                    {canAccessSembako && (
                    <SelectItem value="sembako">
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Sembako
                      </span>
                    </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {editingCategory && (editingCategory._count?.products || 0) > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  <strong>Info:</strong> Kategori ini memiliki {editingCategory._count?.products} produk. Mengubah tipe akan memindahkan produk ke tipe baru.
                </div>
              )}
            </div>
            <DrawerFooter>
              <Button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !formData.type}
                className="gap-2 h-12 text-base bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setFormDialogOpen(false)}
                disabled={saving}
                className="h-12 text-base"
              >
                Batal
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
          <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingCategory ? (
                  <>
                    <Pencil className="h-5 w-5 text-violet-500" />
                    Edit Kategori
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-violet-500" />
                    Tambah Kategori Baru
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Nama Kategori */}
              <div className="grid gap-2">
                <Label htmlFor="category-name">Nama Kategori</Label>
                <Input
                  id="category-name"
                  placeholder="Masukkan nama kategori"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              {/* Tipe */}
              <div className="grid gap-2">
                <Label>Tipe</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, type: val }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {canAccessCakes && (
                    <SelectItem value="cake">
                      <span className="flex items-center gap-2">
                        <Cake className="h-4 w-4" />
                        Kue
                      </span>
                    </SelectItem>
                    )}
                    {canAccessFoods && (
                    <SelectItem value="food">
                      <span className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        Makanan
                      </span>
                    </SelectItem>
                    )}
                    {canAccessSembako && (
                    <SelectItem value="sembako">
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Sembako
                      </span>
                    </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {editingCategory && (editingCategory._count?.products || 0) > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  <strong>Info:</strong> Kategori ini memiliki {editingCategory._count?.products} produk. Mengubah tipe akan memindahkan produk ke tipe baru.
                </div>
              )}
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
                disabled={saving || !formData.name.trim() || !formData.type}
                className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Delete Confirmation Dialog ───────────────────────────── */}
      <Dialog open={!!deletingCategory} onOpenChange={(open) => { if (!open) setDeletingCategory(null); setDeleteError(null); }}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              Hapus Kategori
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus kategori{' '}
              <span className="font-semibold text-gray-900">
                &quot;{deletingCategory?.name}&quot;
              </span>
              ? Kategori yang sudah dihapus tidak dapat dikembalikan.
            </p>
            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setDeletingCategory(null); setDeleteError(null); }}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2 bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
