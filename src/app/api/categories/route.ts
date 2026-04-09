import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {
      ownerId: userId,
    };
    if (type) {
      where.type = type;
    }

    const categories = await db.category.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check feature permission — accept any category-specific permission
    const [canCatCake, canCatFood, canCatSembako] = await Promise.all([
      checkFeatureAccess(role, 'categories_cake'),
      checkFeatureAccess(role, 'categories_food'),
      checkFeatureAccess(role, 'categories_sembako'),
    ]);
    if (!canCatCake && !canCatFood && !canCatSembako) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ error: 'Tipe kategori wajib diisi' }, { status: 400 });
    }

    const category = await db.category.create({
      data: {
        name,
        type,
        ownerId: userId,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
