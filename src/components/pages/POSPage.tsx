'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Cake,
  Search,
  Plus,
  Minus,
  X,
  ShoppingBag,
  Trash2,
  Printer,
  RotateCcw,
  Loader2,
  Package,
  AlertCircle,
  CheckCircle2,
  Percent,
  DollarSign,
  Store,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/use-permission';
import { toImageUrl } from '@/lib/utils';

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

interface Category {
  id: string;
  name: string;
  type: string;
  _count?: { products: number };
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

interface StoreSettings {
  id: string;
  storeName: string;
  address: string;
  phone: string;
  taxRate: number;
  receiptFooter: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface TransactionResult {
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
  items: {
    id: string;
    productName: string;
    productPrice: number;
    quantity: number;
    subtotal: number;
  }[];
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Color palette for product card placeholders
const PRODUCT_COLORS = [
  'bg-blue-100',
  'bg-orange-100',
  'bg-rose-100',
  'bg-pink-100',
  'bg-yellow-100',
  'bg-lime-100',
  'bg-teal-100',
  'bg-cyan-100',
  'bg-fuchsia-100',
  'bg-violet-100',
];

function getProductColor(index: number): string {
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length];
}

function getProductIconColor(index: number): string {
  const colors = [
    'text-blue-600',
    'text-orange-600',
    'text-rose-600',
    'text-pink-600',
    'text-yellow-600',
    'text-lime-600',
    'text-teal-600',
    'text-cyan-600',
    'text-fuchsia-600',
    'text-violet-600',
  ];
  return colors[index % colors.length];
}

// ── Safe product image for POS grid (resets error on src change) ─────────
function POSSafeImage({ src, alt, index }: { src: string; alt: string; index: number }) {
  const resolvedSrc = toImageUrl(src);

  // Derived state pattern to reset error when src changes
  const [prevSrc, setPrevSrc] = useState(resolvedSrc);
  const [error, setError] = useState(false);
  const retryCount = useRef(0);

  if (resolvedSrc !== prevSrc) {
    setPrevSrc(resolvedSrc);
    setError(false);
  }

  if (error) {
    return <Cake className={`size-4 md:size-8 ${getProductIconColor(index)} transition-transform duration-200 group-hover:scale-110`} />;
  }
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      crossOrigin="anonymous"
      className="w-full h-full object-cover"
      onError={() => {
        if (retryCount.current < 2) {
          retryCount.current += 1;
          setError(false);
          setPrevSrc(resolvedSrc + '?retry=' + retryCount.current);
        } else {
          setError(true);
        }
      }}
    />
  );
}

// ── Desktop Cart Panel with Scroll Buttons ──────────────────────────────────
function DesktopCartPanel({
  cart, products, cartItemCount,
  clearCart, updateQuantity, removeFromCart,
  cartSubtotal, discountType, setDiscountType, setDiscountValue,
  discountValue, discountAmount, taxAmount, settings, grandTotal,
  canDiscount, onCheckout,
}: {
  cart: CartItem[];
  products: Product[];
  cartItemCount: number;
  clearCart: () => void;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  cartSubtotal: number;
  discountType: 'percent' | 'fixed';
  setDiscountType: (t: 'percent' | 'fixed') => void;
  setDiscountValue: (v: number) => void;
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  settings: StoreSettings | null;
  grandTotal: number;
  canDiscount: boolean;
  onCheckout: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 2);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, cart]);

  // Re-check when cart items change
  useEffect(() => { checkScroll(); }, [checkScroll, cart.length]);

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  return (
    <div className="hidden md:flex w-[400px] xl:w-[440px] flex-col bg-white shrink-0 min-h-0 relative">
      {/* ── Header (fixed) ── */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-blue-600" />
            <h2 className="font-semibold text-lg">Kasir</h2>
            {cartItemCount > 0 && (
              <Badge className="bg-blue-500 text-white border-0 text-xs">
                {cartItemCount} item
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 text-xs"
            >
              <Trash2 className="size-3.5 mr-1" />
              Hapus Semua
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Scroll buttons ── */}
      {cart.length > 0 && (
        <>
          {canScrollUp && (
            <button
              onClick={() => scrollBy(-120)}
              className="absolute top-[105px] left-1/2 -translate-x-1/2 z-20 bg-white border border-neutral-200 rounded-full shadow-md p-1 hover:bg-neutral-50 transition-all"
              aria-label="Scroll ke atas"
            >
              <ChevronUp className="size-4 text-neutral-600" />
            </button>
          )}
          {canScrollDown && (
            <button
              onClick={() => scrollBy(120)}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-white border border-neutral-200 rounded-full shadow-md p-1 hover:bg-neutral-50 transition-all"
              aria-label="Scroll ke bawah"
            >
              <ChevronDown className="size-4 text-neutral-600" />
            </button>
          )}
        </>
      )}

      {/* ── Scrollable area: everything below header ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12 px-5">
            <ShoppingBag className="size-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Keranjang kosong</p>
            <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="p-3 space-y-2">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${getProductColor(products.indexOf(item.product))} flex items-center justify-center shrink-0`}
                  >
                    <Cake className={`size-5 ${getProductIconColor(products.indexOf(item.product))}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatRupiah(item.product.price)} / item</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="icon" className="size-7 rounded-md h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="size-7 rounded-md h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)} disabled={item.quantity >= item.product.stock}>
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                    <p className="text-sm font-semibold text-blue-700">{formatRupiah(item.product.price * item.quantity)}</p>
                    <Button variant="ghost" size="icon" className="size-6 rounded-md h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={() => removeFromCart(item.product.id)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order summary */}
            <div className="border-t border-neutral-200 bg-neutral-50/50">
              {/* Discount */}
              {canDiscount && (
              <div className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground font-medium w-16">Diskon</span>
                  <div className="flex-1 flex gap-1.5">
                    <div className="flex rounded-md border overflow-hidden">
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={`px-2 py-1 text-xs font-medium transition-colors ${
                          discountType === 'percent'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-muted-foreground hover:bg-neutral-100'
                        }`}
                      >
                        <Percent className="size-3" />
                      </button>
                      <button
                        onClick={() => setDiscountType('fixed')}
                        className={`px-2 py-1 text-xs font-medium transition-colors ${
                          discountType === 'fixed'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-muted-foreground hover:bg-neutral-100'
                        }`}
                      >
                        <DollarSign className="size-3" />
                      </button>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={discountValue || ''}
                      onChange={(e) =>
                        setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      placeholder="0"
                      className="h-8 text-xs w-24"
                    />
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Diskon ({discountType === 'percent' ? `${discountValue}%` : formatRupiah(discountValue)})</span>
                    <span className="text-red-500">-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
              </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="px-5 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatRupiah(cartSubtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pajak ({settings?.taxRate || 0}%)</span>
                    <span>{formatRupiah(taxAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-xl font-bold text-blue-700">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              <Separator />

              {/* Checkout button */}
              <div className="px-5 py-3 pb-5">
                <Button
                  onClick={onCheckout}
                  disabled={cart.length === 0}
                  className="w-full h-12 text-base font-bold rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <CheckCircle2 className="size-5" />
                  KONFIRMASI PESANAN
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────
export default function POSPage() {
  const { token } = useAuthStore();
  const isMobile = useIsMobile();

  // ── Permission checks ──
  const canDiscount = usePermission('pos_discount');
  const canPrintReceipt = usePermission('pos_receipt');
  const canAccessCakes = usePermission('cakes');
  const canAccessFoods = usePermission('foods');
  const canAccessSembako = usePermission('sembako');

  // ── Mobile tab state ──
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // ── Data state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  // ── UI state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Cart state ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('umum');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(0);

  // ── Payment state ──
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris' | 'debit'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Add customer dialog state ──
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState('');

  // ── Receipt state ──
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<TransactionResult | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);

  // ── Product grid scroll state ──
  const productScrollRef = useRef<HTMLDivElement>(null);
  const [productScrollCanUp, setProductScrollCanUp] = useState(false);
  const [productScrollCanDown, setProductScrollCanDown] = useState(false);

  const checkProductScroll = useCallback(() => {
    const el = productScrollRef.current;
    if (!el) return;
    setProductScrollCanUp(el.scrollTop > 2);
    setProductScrollCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    const el = productScrollRef.current;
    if (!el) return;
    checkProductScroll();
    el.addEventListener('scroll', checkProductScroll, { passive: true });
    window.addEventListener('resize', checkProductScroll);
    return () => {
      el.removeEventListener('scroll', checkProductScroll);
      window.removeEventListener('resize', checkProductScroll);
    };
  }, [checkProductScroll]);

  const productScrollBy = useCallback((delta: number) => {
    productScrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  // ── API Helper ──
  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token]
  );

  // ── Load initial data ──
  useEffect(() => {
    async function loadData() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const [productsRes, categoriesRes, customersRes, settingsRes] = await Promise.all([
          fetch('/api/products?isActive=true', authHeaders),
          fetch('/api/categories', authHeaders),
          fetch('/api/customers', authHeaders),
          fetch('/api/settings', authHeaders),
        ]);

        if (!productsRes.ok || !categoriesRes.ok || !customersRes.ok || !settingsRes.ok) {
          throw new Error('Gagal memuat data');
        }

        const [productsData, categoriesData, customersData, settingsData] = await Promise.all([
          productsRes.json(),
          categoriesRes.json(),
          customersRes.json(),
          settingsRes.json(),
        ]);

        setProducts(productsData);
        setCategories(categoriesData);
        setCustomers(customersData);
        setSettings(settingsData);
        setLoadError('');
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [token, authHeaders]);

  // ── Allowed category types based on role permissions ──
  const allowedTypes = useMemo(() => {
    const types: string[] = [];
    if (canAccessCakes) types.push('cake');
    if (canAccessFoods) types.push('food');
    if (canAccessSembako) types.push('sembako');
    return types;
  }, [canAccessCakes, canAccessFoods, canAccessSembako]);

  // ── Filter products & categories based on allowed types ──
  const permittedCategories = useMemo(() => {
    if (allowedTypes.length === 0) return [];
    return categories.filter((cat) => allowedTypes.includes(cat.type));
  }, [categories, allowedTypes]);

  const permittedCategoryIds = useMemo(
    () => new Set(permittedCategories.map((c) => c.id)),
    [permittedCategories]
  );

  // ── Filter products ──
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => permittedCategoryIds.has(p.categoryId));

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query));
    }

    return result;
  }, [products, selectedCategory, searchQuery, permittedCategoryIds]);

  // Reset selected category if it's no longer permitted
  useEffect(() => {
    if (selectedCategory !== 'all' && !permittedCategoryIds.has(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [selectedCategory, permittedCategoryIds]);

  // Re-check product scroll when filtered products change
  useEffect(() => { checkProductScroll(); }, [checkProductScroll, filteredProducts.length]);

  // ── Cart operations ──
  const addToCart = useCallback(
    (product: Product) => {
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        const currentQtyInCart = existing ? existing.quantity : 0;
        // Can't add if total would exceed actual stock
        if (currentQtyInCart >= product.stock) return prev;
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        if (product.stock <= 0) return prev;
        return [...prev, { product, quantity: 1 }];
      });
    },
    []
  );

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountValue(0);
    setAmountPaid('');
    setPaymentError('');
  }, []);

  // ── Cart calculations ──
  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round((cartSubtotal * discountValue) / 100);
    }
    return discountValue;
  }, [cartSubtotal, discountType, discountValue]);

  const afterDiscount = cartSubtotal - discountAmount;

  const taxAmount = useMemo(() => {
    if (!settings) return 0;
    return Math.round((afterDiscount * settings.taxRate) / 100);
  }, [afterDiscount, settings]);

  const grandTotal = afterDiscount + taxAmount;

  const changeAmount = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return paid - grandTotal;
  }, [amountPaid, grandTotal]);

  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  // ── Add customer from POS ──
  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) {
      setAddCustomerError('Nama customer wajib diisi');
      return;
    }
    setIsAddingCustomer(true);
    setAddCustomerError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        ...authHeaders,
        headers: { ...authHeaders.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          address: newCustomerAddress.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menambah customer');
      }
      const newCustomer = await res.json();
      setCustomers((prev) => [...prev, newCustomer]);
      setSelectedCustomer(newCustomer.id);
      setShowAddCustomerDialog(false);
    } catch (err) {
      setAddCustomerError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // ── Open checkout dialog ──
  const openCheckoutDialog = () => {
    setPaymentMethod('cash');
    setAmountPaid('');
    setPaymentError('');
    setShowCheckoutDialog(true);
  };

  // ── Payment handling ──
  const handlePayment = async () => {
    setPaymentError('');

    if (cart.length === 0) {
      setPaymentError('Keranjang belanja kosong');
      return;
    }

    if (paymentMethod === 'cash') {
      const paid = parseFloat(amountPaid) || 0;
      if (paid < grandTotal) {
        setPaymentError('Jumlah pembayaran kurang');
        return;
      }
    }

    setIsProcessing(true);
    try {
      const body = {
        customerId: selectedCustomer === 'umum' ? null : selectedCustomer,
        discount: discountAmount,
        tax: taxAmount,
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? parseFloat(amountPaid) || grandTotal : grandTotal,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        ...authHeaders,
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses transaksi');
      }

      setCompletedTransaction(data);
      setShowReceipt(true);
      setShowCheckoutDialog(false);
      setPaymentError('');
      clearCart();
      setSelectedCustomer('umum');
      // Immediately refetch products to show updated stock
      try {
        const productsRes = await fetch('/api/products?isActive=true', authHeaders);
        if (productsRes.ok) {
          const updatedProducts = await productsRes.json();
          setProducts(updatedProducts);
        }
      } catch {
        // Silent fail - stock will update on next page load
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Gagal memproses transaksi');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewTransaction = () => {
    setShowReceipt(false);
    setCompletedTransaction(null);
    clearCart();
    // Switch back to products on mobile
    if (isMobileRef.current) {
      setMobileTab('products');
    }
  };

  // ── Payment method options ──
  const paymentMethods = [
    { id: 'cash' as const, label: 'TUNAI' },
    { id: 'transfer' as const, label: 'TRANSFER' },
    { id: 'qris' as const, label: 'QRIS' },
    { id: 'debit' as const, label: 'DEBIT' },
  ];

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Memuat data POS...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-neutral-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="size-6 text-red-600" />
            </div>
            <div className="text-center">
              <h2 className="font-semibold text-lg">Gagal Memuat Data</h2>
              <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline">
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0 bg-neutral-50 overflow-hidden">
      {/* ═══════════════ MOBILE TAB BAR ═══════════════ */}
      {isMobile && (
        <div className="flex border-b bg-card sticky top-0 z-10 shrink-0">
          <button
            onClick={() => setMobileTab('products')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              mobileTab === 'products'
                ? 'text-blue-700 border-b-2 border-blue-500'
                : 'text-muted-foreground'
            }`}
          >
            Produk
          </button>
          <button
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
              mobileTab === 'cart'
                ? 'text-blue-700 border-b-2 border-blue-500'
                : 'text-muted-foreground'
            }`}
          >
            Keranjang
            {cartItemCount > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-24px)] bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ═══════════════ LEFT SIDE: Product Selection ═══════════════ */}
      {(!isMobile || mobileTab === 'products') && (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 md:border-r border-neutral-200">
          {/* ── Search bar ── */}
          <div className="p-4 pb-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white"
              />
            </div>
          </div>

          {/* ── Category tabs ── */}
          <div className="px-4 pt-3 pb-2">
            <ScrollArea className="w-full overflow-x-auto">
              <div className="flex gap-2 pb-1">
                <Button
                  size="sm"
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                  className="shrink-0 rounded-full"
                >
                  Semua
                </Button>
                {permittedCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="shrink-0 rounded-full"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* ── Product count ── */}
          <div className="px-4 py-1">
            <p className="text-xs text-muted-foreground">
              {filteredProducts.length} produk ditemukan
            </p>
          </div>

          {/* ── Product grid with scroll buttons ── */}
          <div className="flex-1 min-h-0 px-4 relative">
            {/* Scroll up button */}
            {productScrollCanUp && (
              <button
                onClick={() => productScrollBy(-150)}
                className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-white border border-neutral-200 rounded-full shadow-md p-1 hover:bg-neutral-50 transition-all"
                aria-label="Scroll ke atas"
              >
                <ChevronUp className="size-4 text-neutral-600" />
              </button>
            )}
            {/* Scroll down button */}
            {productScrollCanDown && (
              <button
                onClick={() => productScrollBy(150)}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 bg-white border border-neutral-200 rounded-full shadow-md p-1 hover:bg-neutral-50 transition-all"
                aria-label="Scroll ke bawah"
              >
                <ChevronDown className="size-4 text-neutral-600" />
              </button>
            )}
            <div ref={productScrollRef} className="h-full overflow-y-auto overscroll-contain py-1 -webkit-overflow-scrolling: touch">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="size-12 mb-3 opacity-40" />
                <p className="text-sm">Produk tidak ditemukan</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 pb-4">
                {filteredProducts.map((product, index) => {
                  const inCart = cart.find((item) => item.product.id === product.id);
                  const cartQty = inCart ? inCart.quantity : 0;
                  // Available stock = real stock minus what's already in cart
                  const availableStock = product.stock - cartQty;
                  const isOutOfStock = availableStock <= 0;
                  const isLowStock = availableStock > 0 && availableStock <= 5;

                  return (
                    <Card
                      key={product.id}
                      className={`
                        group cursor-pointer transition-all duration-200 overflow-hidden
                        hover:shadow-md hover:-translate-y-0.5
                        ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}
                        ${inCart ? 'ring-2 ring-blue-400 shadow-sm' : ''}
                      `}
                      onClick={() => !isOutOfStock && addToCart(product)}
                    >
                      <CardContent className="p-1.5 md:p-3">
                        {/* Product image placeholder */}
                        <div
                          className={`relative w-full aspect-square rounded-lg ${getProductColor(
                            index
                          )} flex items-center justify-center mb-1 md:mb-2.5 overflow-hidden`}
                        >
                          {product.image ? (
                            <POSSafeImage src={product.image} alt={product.name} index={index} />
                          ) : (
                          <Cake
                            className={`size-4 md:size-8 ${getProductIconColor(index)} transition-transform duration-200 group-hover:scale-110`}
                          />
                          )}
                          {/* Stock badge */}
                          <Badge
                            className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0 ${
                              isOutOfStock
                                ? 'bg-red-500 text-white border-0'
                                : isLowStock
                                ? 'bg-orange-100 text-orange-700 border-orange-200'
                                : 'bg-white/90 text-green-700 border-green-200'
                            }`}
                          >
                            {isOutOfStock ? 'Habis' : `Stok: ${availableStock}`}
                          </Badge>
                          {/* Minus button on product card (visible on mobile & desktop when in cart) */}
                          {inCart && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (inCart.quantity <= 1) {
                                  removeFromCart(product.id);
                                } else {
                                  updateQuantity(product.id, -1);
                                }
                              }}
                              className="absolute top-1.5 left-1.5 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md transition-colors"
                              aria-label="Kurangi dari keranjang"
                            >
                              <Minus className="size-3.5" />
                            </button>
                          )}
                          {/* Cart quantity overlay */}
                          {inCart && (
                            <div className="absolute bottom-1.5 left-1.5 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                              {inCart.quantity}
                            </div>
                          )}
                        </div>

                        {/* Product info */}
                        <h3 className="text-[10px] md:text-sm font-medium leading-tight line-clamp-1 md:line-clamp-2 min-h-[1.25rem] md:min-h-[2.5rem] mb-0.5 md:mb-1.5">
                          {product.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] md:text-sm font-bold text-blue-700">
                            {formatRupiah(product.price)}
                          </p>
                          {!isOutOfStock && (
                            <div className="rounded-full bg-blue-100 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="size-3.5 text-blue-700" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0">
                          {product.category.name}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RIGHT SIDE: Cart & Payment (Desktop) ═══════════════ */}
      {!isMobile && (
        <DesktopCartPanel
          cart={cart}
          products={products}
          cartItemCount={cartItemCount}
          clearCart={clearCart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          cartSubtotal={cartSubtotal}
          discountType={discountType}
          setDiscountType={setDiscountType}
          setDiscountValue={setDiscountValue}
          discountValue={discountValue}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          settings={settings}
          grandTotal={grandTotal}
          canDiscount={canDiscount}
          onCheckout={openCheckoutDialog}
        />
      )}

      {/* ═══════════════ MOBILE: Cart (full scrollable column) ═══════════════ */}
      {isMobile && mobileTab === 'cart' && (
        <div className="flex flex-col bg-white flex-1 min-h-0 overflow-y-auto">
          {cart.length === 0 ? (
            /* Empty cart state on mobile */
            <div className="flex flex-col items-center justify-center text-muted-foreground py-16 px-5">
              <ShoppingBag className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Keranjang kosong</p>
              <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setMobileTab('products')}
              >
                Lihat Produk
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-5 text-blue-600" />
                    <h2 className="font-semibold text-lg">Kasir</h2>
                    {cartItemCount > 0 && (
                      <Badge className="bg-blue-500 text-white border-0 text-xs">
                        {cartItemCount} item
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 text-xs"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Hapus Semua
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Cart items (natural flow, no ScrollArea) */}
              <div className="p-3 space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
                  >
                    {/* Product icon */}
                    <div
                      className={`w-10 h-10 rounded-lg ${getProductColor(
                        products.indexOf(item.product)
                      )} flex items-center justify-center shrink-0`}
                    >
                      <Cake
                        className={`size-5 ${getProductIconColor(
                          products.indexOf(item.product)
                        )}`}
                      />
                    </div>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRupiah(item.product.price)} / item
                      </p>
                    </div>

                    {/* Quantity + remove */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 rounded-md h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 rounded-md h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>

                    {/* Subtotal + remove button */}
                    <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                      <p className="text-sm font-semibold text-blue-700">
                        {formatRupiah(item.product.price * item.quantity)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-md h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order summary */}
              <div className="border-t border-neutral-200 bg-neutral-50/50">
                {/* Discount */}
                {canDiscount && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground font-medium w-16">Diskon</span>
                    <div className="flex-1 flex gap-1.5">
                      <div className="flex rounded-md border overflow-hidden">
                        <button
                          onClick={() => setDiscountType('percent')}
                          className={`px-2 py-1 text-xs font-medium transition-colors ${
                            discountType === 'percent'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-muted-foreground hover:bg-neutral-100'
                          }`}
                        >
                          <Percent className="size-3" />
                        </button>
                        <button
                          onClick={() => setDiscountType('fixed')}
                          className={`px-2 py-1 text-xs font-medium transition-colors ${
                            discountType === 'fixed'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-muted-foreground hover:bg-neutral-100'
                          }`}
                        >
                          <DollarSign className="size-3" />
                        </button>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={discountValue || ''}
                        onChange={(e) =>
                          setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        placeholder="0"
                        className="h-8 text-xs w-24"
                      />
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Diskon ({discountType === 'percent' ? `${discountValue}%` : formatRupiah(discountValue)})</span>
                      <span className="text-red-500">-{formatRupiah(discountAmount)}</span>
                    </div>
                  )}
                </div>
                )}

                <Separator />

                {/* Totals */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatRupiah(cartSubtotal)}</span>
                  </div>
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Pajak ({settings?.taxRate || 0}%)
                      </span>
                      <span>{formatRupiah(taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-semibold">Total</span>
                    <span className="text-xl font-bold text-blue-700">
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Checkout button */}
                <div className="px-4 py-3 pb-6">
                  <Button
                    onClick={openCheckoutDialog}
                    disabled={cart.length === 0}
                    className="w-full h-12 text-base font-bold rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    <CheckCircle2 className="size-5" />
                    KONFIRMASI PESANAN
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ ADD CUSTOMER POPUP ═══════════════ */}
      <Dialog open={showAddCustomerDialog} onOpenChange={(open) => { if (!open) setShowAddCustomerDialog(false); }}>
        <DialogContent className={isMobile ? "w-[calc(100vw-2rem)] max-w-full p-0 gap-0 [&>button]:hidden" : "sm:max-w-md max-w-[calc(100vw-2rem)]"}>
          {isMobile ? (
            <>
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                <DialogTitle className="text-lg font-semibold">Tambah Customer Baru</DialogTitle>
                <button onClick={() => setShowAddCustomerDialog(false)} className="rounded-full p-1 hover:bg-neutral-100 transition-colors">
                  <X className="size-5 text-neutral-500" />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pos-cust-name" className="text-sm">Nama <span className="text-red-500">*</span></Label>
                  <Input id="pos-cust-name" placeholder="Nama lengkap customer" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="h-11 text-base" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pos-cust-phone" className="text-sm">No. HP</Label>
                  <Input id="pos-cust-phone" placeholder="08xx-xxxx-xxxx" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} className="h-11 text-base" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pos-cust-address" className="text-sm">Alamat</Label>
                  <Input id="pos-cust-address" placeholder="Alamat customer" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} className="h-11 text-base" autoComplete="off" />
                </div>
                {addCustomerError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{addCustomerError}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-4 pb-4 pt-3 border-t">
                <Button variant="outline" onClick={() => setShowAddCustomerDialog(false)} disabled={isAddingCustomer} className="flex-1 h-11">
                  Batal
                </Button>
                <Button onClick={handleAddCustomer} disabled={isAddingCustomer} className="flex-1 h-11 gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold">
                  {isAddingCustomer ? <><Loader2 className="size-4 animate-spin" /> Menyimpan...</> : 'Tambah'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Tambah Customer Baru</DialogTitle>
                <DialogDescription>Isi data customer baru.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="pos-cust-name-d">Nama <span className="text-red-500">*</span></Label>
                  <Input id="pos-cust-name-d" placeholder="Nama lengkap customer" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-cust-phone-d">No. HP</Label>
                  <Input id="pos-cust-phone-d" placeholder="08xx-xxxx-xxxx" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pos-cust-address-d">Alamat</Label>
                  <Input id="pos-cust-address-d" placeholder="Alamat customer" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} autoComplete="off" />
                </div>
                {addCustomerError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 text-red-600 text-xs">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{addCustomerError}</span>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowAddCustomerDialog(false)}>Batal</Button>
                <Button onClick={handleAddCustomer} disabled={isAddingCustomer} className="bg-blue-500 hover:bg-blue-600 text-white">
                  {isAddingCustomer ? <><Loader2 className="size-4 animate-spin" /> Menyimpan...</> : 'Tambah Customer'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ RECEIPT DIALOG ═══════════════ */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <CheckCircle2 className="size-5 text-emerald-500" />
              Transaksi Berhasil
            </DialogTitle>
            <DialogDescription className="text-center">
              Pembayaran berhasil diproses
            </DialogDescription>
          </DialogHeader>
          {completedTransaction && (
            <>
              {/* Receipt card with scroll */}
              <ScrollArea className="max-h-[60vh]">
              <div className="bg-white border-2 border-dashed border-neutral-300 rounded-lg p-4 font-mono text-xs pr-3">
                {/* Store info */}
                <div className="text-center mb-3">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Store className="size-4" />
                    <span className="font-bold text-sm">
                      {settings?.storeName || 'Sweet Bakery & Food'}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{settings?.address || ''}</p>
                  <p className="text-muted-foreground">{settings?.phone || ''}</p>
                </div>

                <Separator className="my-2" />

                {/* Transaction info */}
                <div className="space-y-0.5 mb-2">
                  <div className="flex justify-between">
                    <span>No. Invoice</span>
                    <span className="font-semibold">
                      {completedTransaction.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal</span>
                    <span>{formatDate(completedTransaction.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu</span>
                    <span>{formatTime(completedTransaction.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir</span>
                    <span>{completedTransaction.user.name}</span>
                  </div>
                  {completedTransaction.customer && (
                    <div className="flex justify-between">
                      <span>Pelanggan</span>
                      <span>{completedTransaction.customer.name}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-2" />

                {/* Items */}
                <div className="space-y-1.5 mb-2">
                  {completedTransaction.items.map((item) => (
                    <div key={item.id}>
                      <p className="font-medium">{item.productName}</p>
                      <div className="flex justify-between text-muted-foreground pl-2">
                        <span>
                          {item.quantity} x {formatRupiah(item.productPrice)}
                        </span>
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
                    <span>{formatRupiah(completedTransaction.subtotal)}</span>
                  </div>
                  {completedTransaction.discount > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Diskon</span>
                      <span>-{formatRupiah(completedTransaction.discount)}</span>
                    </div>
                  )}
                  {completedTransaction.tax > 0 && (
                    <div className="flex justify-between">
                      <span>Pajak</span>
                      <span>{formatRupiah(completedTransaction.tax)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL</span>
                    <span>{formatRupiah(completedTransaction.total)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <span>
                      {completedTransaction.paymentMethod === 'cash'
                        ? 'Tunai'
                        : completedTransaction.paymentMethod === 'transfer'
                        ? 'Transfer'
                        : completedTransaction.paymentMethod === 'qris'
                        ? 'QRIS'
                        : completedTransaction.paymentMethod === 'debit'
                        ? 'Debit'
                        : 'Kredit'}
                    </span>
                    <span>{formatRupiah(completedTransaction.amountPaid)}</span>
                  </div>
                  {completedTransaction.change > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span>Kembalian</span>
                      <span>{formatRupiah(completedTransaction.change)}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-2" />

                {/* Footer */}
                <p className="text-center text-muted-foreground italic">
                  {settings?.receiptFooter || 'Terima kasih atas kunjungan Anda!'}
                </p>
              </div>
              </ScrollArea>

              {/* Action buttons */}
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {canPrintReceipt && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Printer className="size-4 mr-2" />
                  Cetak Struk
                </Button>
                )}
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={handleNewTransaction}
                >
                  <RotateCcw className="size-4 mr-2" />
                  Transaksi Baru
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MOBILE: Floating cart button ═══════════════ */}
      {isMobile && mobileTab === 'products' && cart.length > 0 && (
        <button
          onClick={() => setMobileTab('cart')}
          className="fixed bottom-4 left-4 right-4 z-30 bg-blue-500 text-white rounded-xl py-3 px-4 flex items-center justify-between shadow-lg shadow-blue-500/30"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5" />
            <span className="font-semibold">{cartItemCount} item</span>
          </div>
          <span className="font-bold">{formatRupiah(grandTotal)}</span>
        </button>
      )}

      {/* ═══════════════ KONFIRMASI PESANAN DIALOG ═══════════════ */}
      <Dialog open={showCheckoutDialog} onOpenChange={(open) => {
        if (!open && !isProcessing) {
          setShowCheckoutDialog(false);
          setPaymentError('');
        }
      }}>
        <DialogContent
          className="sm:max-w-md max-w-[calc(100vw-2rem)]"
          onPointerDownOutside={(e) => { if (isProcessing) e.preventDefault(); }}
          onInteractOutside={(e) => { if (isProcessing) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-blue-500" />
              Konfirmasi Pesanan
            </DialogTitle>
            <DialogDescription>
              {cartItemCount} item
            </DialogDescription>
          </DialogHeader>

          {/* Total Harga */}
          <div className="flex justify-between items-center p-4 rounded-xl bg-neutral-50 border border-neutral-200">
            <span className="text-sm font-semibold text-neutral-600">Total Harga</span>
            <span className="text-[32px] leading-tight font-bold text-black">{formatRupiah(grandTotal)}</span>
          </div>

          <div className="space-y-4 py-2">
            {/* Nama Pelanggan */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama Pelanggan</label>
              <div className="flex gap-2">
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih pelanggan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="umum">Umum (Tanpa Pelanggan)</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.phone ? ` - ${customer.phone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => {
                    setNewCustomerName('');
                    setNewCustomerPhone('');
                    setNewCustomerAddress('');
                    setAddCustomerError('');
                    setShowAddCustomerDialog(true);
                  }}
                  title="Tambah Customer Baru"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            {/* Metode Pembayaran */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Metode Pembayaran</label>
              <div className="grid grid-cols-4 gap-2">
                {paymentMethods.map((method) => {
                  const isActive = paymentMethod === method.id;
                  return (
                    <Button
                      key={method.id}
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => { setPaymentMethod(method.id); setAmountPaid(''); }}
                      className={`h-11 text-xs font-bold ${isActive ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}`}
                    >
                      {method.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Jumlah Dibayar + Shortcut (only for cash) */}
            {paymentMethod === 'cash' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Jumlah Dibayar</label>
                <Input
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Masukkan jumlah"
                  className="h-11 text-base font-semibold"
                />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    grandTotal,
                    Math.ceil(grandTotal / 10000) * 10000,
                    Math.ceil(grandTotal / 50000) * 50000,
                    Math.ceil(grandTotal / 100000) * 100000,
                    Math.ceil(grandTotal / 200000) * 200000,
                    500000,
                  ]
                    .filter((v, i, arr) => arr.indexOf(v) === i && v > 0)
                    .slice(0, 6)
                    .map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs font-semibold"
                        onClick={() => setAmountPaid(String(amount))}
                      >
                        {formatRupiah(amount)}
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {/* Kembalian */}
            {paymentMethod === 'cash' && parseFloat(amountPaid) > 0 && (
              <div className={`flex justify-between items-center p-3 rounded-lg ${
                changeAmount >= 0
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <span className="text-sm font-medium">Kembalian</span>
                <span className={`text-lg font-bold ${changeAmount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatRupiah(Math.max(0, changeAmount))}
                </span>
              </div>
            )}

            {/* Error */}
            {paymentError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                <AlertCircle className="size-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowCheckoutDialog(false); setPaymentError(''); }}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (paymentMethod === 'cash') {
                  const paid = parseFloat(amountPaid) || 0;
                  if (paid < grandTotal) {
                    setPaymentError('Jumlah pembayaran kurang');
                    return;
                  }
                }
                handlePayment();
              }}
              disabled={isProcessing || cart.length === 0}
              className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12"
            >
              {isProcessing ? (
                <><Loader2 className="size-5 animate-spin" />Memproses...</>
              ) : (
                <><CheckCircle2 className="size-5" />Bayar Sekarang</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
