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
    const categoryId = searchParams.get('categoryId');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = { ownerId: userId };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (type) {
      where.category = { type };
    }

    if (search) {
      where.name = { contains: search };
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check feature permission from database (type-specific)
    const body = await request.json();
    const { categoryId } = body;

    // Determine product type from category
    let permissionKey = 'food_add'; // default
    if (categoryId) {
      const category = await db.category.findFirst({ where: { id: categoryId }, select: { type: true } });
      if (category) {
        permissionKey = category.type === 'cake' ? 'cake_add' : category.type === 'sembako' ? 'sembako_add' : 'food_add';
      }
    }
    const allowed = await checkFeatureAccess(role, permissionKey);
    if (!allowed) {
      const typeName = permissionKey === 'cake_add' ? 'kue' : permissionKey === 'sembako_add' ? 'sembako' : 'makanan';
      return NextResponse.json({ error: `Akses ditolak. Anda tidak memiliki izin untuk menambah ${typeName}.` }, { status: 403 });
    }

    const { name, price, capitalPrice, stock, image } = body;

    if (!name || price === undefined || !categoryId) {
      return NextResponse.json({ error: 'Nama, harga, dan kategori wajib diisi' }, { status: 400 });
    }

    const product = await db.product.create({
      data: {
        name,
        price: Number(price),
        capitalPrice: Number(capitalPrice) || 0,
        stock: Number(stock) || 0,
        image: image || null,
        categoryId,
        ownerId: userId,
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
