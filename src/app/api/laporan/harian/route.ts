import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

function getDateRange(dateStr: string) {
  const date = new Date(dateStr);
  // Start of day: 00:00:00.000
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  // End of day: 23:59:59.999
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Default to today if no date provided
    const today = new Date();
    const targetDate = dateParam
      ? new Date(dateParam)
      : today;

    // Validate date
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const { startOfDay, endOfDay } = getDateRange(targetDate.toISOString().split('T')[0]);

    const transactions = await db.transaction.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, capitalPrice: true, category: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Collect product IDs for batch fetch of capital prices
    const productIds = new Set<string>();
    for (const tx of transactions) {
      for (const item of tx.items) {
        productIds.add(item.productId);
      }
    }

    const productPrices = new Map<string, number>();
    if (productIds.size > 0) {
      const products = await db.product.findMany({
        where: { id: { in: Array.from(productIds) } },
        select: { id: true, capitalPrice: true },
      });
      for (const p of products) {
        productPrices.set(p.id, p.capitalPrice || 0);
      }
    }

    const totalTransactions = transactions.length;
    const totalPenjualan = transactions.reduce((sum, tx) => sum + tx.total, 0);

    // Calculate total modal (HPP)
    let totalModal = 0;
    for (const tx of transactions) {
      for (const item of tx.items) {
        const capitalPrice = productPrices.get(item.productId) || 0;
        totalModal += capitalPrice * item.quantity;
      }
    }

    const profit = totalPenjualan - totalModal;

    return NextResponse.json({
      transactions,
      summary: {
        totalTransactions,
        totalPenjualan: Math.round(totalPenjualan),
        totalModal: Math.round(totalModal),
        profit: Math.round(profit),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
