import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

function getDefaultDateRange() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to current month if no dates provided
    const { startOfMonth, endOfMonth } = getDefaultDateRange();
    const startDate = startDateParam ? new Date(startDateParam) : startOfMonth;
    const endDate = endDateParam ? new Date(endDateParam) : endOfMonth;

    // Validate dates
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal mulai tidak valid. Gunakan format YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal akhir tidak valid. Gunakan format YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Set start to beginning of day, end to end of day
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    // Fetch all transaction items within date range with product category
    const transactionItems = await db.transactionItem.findMany({
      where: {
        transaction: {
          createdAt: {
            gte: start,
            lte: end,
          },
          userId,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by product name
    const productMap = new Map<string, {
      name: string;
      category: string | null;
      qty: number;
      pendapatan: number;
    }>();

    for (const item of transactionItems) {
      const key = item.productId; // Use productId as unique key (product may have been renamed)
      const existing = productMap.get(key);

      if (existing) {
        existing.qty += item.quantity;
        existing.pendapatan += item.subtotal;
      } else {
        productMap.set(key, {
          name: item.productName,
          category: item.product?.category?.name ?? null,
          qty: item.quantity,
          pendapatan: item.subtotal,
        });
      }
    }

    // Convert map to array and sort by qty descending (best selling first)
    const products = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty);

    // Calculate summary
    const totalQty = products.reduce((sum, p) => sum + p.qty, 0);
    const totalPendapatan = products.reduce((sum, p) => sum + p.pendapatan, 0);
    const uniqueProducts = products.length;

    return NextResponse.json({
      products,
      summary: {
        totalQty,
        totalPendapatan: Math.round(totalPendapatan),
        uniqueProducts,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
