import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product || product.ownerId !== userId) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check feature permission — accept any category-specific edit permission
    const [canEditCake, canEditFood, canEditSembako] = await Promise.all([
      checkFeatureAccess(role, 'cake_edit'),
      checkFeatureAccess(role, 'food_edit'),
      checkFeatureAccess(role, 'sembako_edit'),
    ]);
    if (!canEditCake && !canEditFood && !canEditSembako) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengedit produk.' }, { status: 403 });
    }

    const { id } = await params;

    // Ownership check
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();
    const { name, price, capitalPrice, stock, image, categoryId, isActive } = body;

    const product = await db.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(capitalPrice !== undefined && { capitalPrice: Number(capitalPrice) }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(image !== undefined && { image }),
        ...(categoryId !== undefined && { categoryId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check feature permission — accept any category-specific delete permission
    const [canDelCake, canDelFood, canDelSembako] = await Promise.all([
      checkFeatureAccess(role, 'cake_delete'),
      checkFeatureAccess(role, 'food_delete'),
      checkFeatureAccess(role, 'sembako_delete'),
    ]);
    if (!canDelCake && !canDelFood && !canDelSembako) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk menghapus produk.' }, { status: 403 });
    }

    const { id } = await params;

    // Ownership check
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    // Check if product has related transaction items
    const transactionItemCount = await db.transactionItem.count({
      where: { productId: id },
    });

    if (transactionItemCount > 0) {
      // Soft delete: set isActive to false to preserve transaction history
      await db.product.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ message: 'Produk dinonaktifkan (memiliki riwayat transaksi)' });
    }

    // Hard delete only if no transaction history
    await db.product.delete({ where: { id } });

    return NextResponse.json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
