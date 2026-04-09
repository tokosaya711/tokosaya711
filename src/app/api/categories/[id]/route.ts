import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

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
      checkFeatureAccess(role, 'category_edit_cake'),
      checkFeatureAccess(role, 'category_edit_food'),
      checkFeatureAccess(role, 'category_edit_sembako'),
    ]);
    if (!canEditCake && !canEditFood && !canEditSembako) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, type } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    // Check if category exists and belongs to user
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    const category = await db.category.update({
      where: { id },
      data: {
        name,
        type: type || existing.type,
      },
    });

    return NextResponse.json(category);
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
      checkFeatureAccess(role, 'category_delete_cake'),
      checkFeatureAccess(role, 'category_delete_food'),
      checkFeatureAccess(role, 'category_delete_sembako'),
    ]);
    if (!canDelCake && !canDelFood && !canDelSembako) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori.' }, { status: 403 });
    }

    const { id } = await params;

    // Check if category exists and belongs to user
    const category = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category || category.ownerId !== userId) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        { error: `Kategori ini memiliki ${category._count.products} produk. Hapus atau pindahkan produk terlebih dahulu.` },
        { status: 400 }
      );
    }

    await db.category.delete({ where: { id } });

    return NextResponse.json({ message: 'Kategori berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
