import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'stock');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengelola stok.' }, { status: 403 });
    }

    const lowStockProducts = await db.product.findMany({
      where: {
        isActive: true,
        ownerId: userId,
        stock: {
          lt: 10,
        },
      },
      include: {
        category: true,
      },
      orderBy: { stock: 'asc' },
    });

    return NextResponse.json(lowStockProducts);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'stock_edit');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengubah stok.' }, { status: 403 });
    }

    const body = await request.json();
    const { productId, stock, stockStatus } = body;

    if (!productId || stock === undefined) {
      return NextResponse.json(
        { error: 'ID produk dan stok wajib diisi' },
        { status: 400 }
      );
    }

    if (Number(stock) < 0) {
      return NextResponse.json({ error: 'Stok tidak boleh negatif' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { stock: Number(stock) };
    if (stockStatus !== undefined) {
      updateData.stockStatus = String(stockStatus);
    }

    // Verify product belongs to the logged-in user
    const existingProduct = await db.product.findUnique({
      where: { id: productId },
      select: { ownerId: true },
    });

    if (!existingProduct || existingProduct.ownerId !== userId) {
      return NextResponse.json({ error: 'Produk tidak ditemukan atau Anda tidak memiliki akses.' }, { status: 403 });
    }

    const product = await db.product.update({
      where: { id: productId },
      data: updateData,
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
