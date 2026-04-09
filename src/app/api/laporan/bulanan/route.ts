import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

function getMonthRange(month: number, year: number) {
  // Start of month: 1st day 00:00:00.000
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  // End of month: last day 23:59:59.999
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    // Default to current month and year
    const now = new Date();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // Validate month (1-12)
    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Bulan harus berupa angka antara 1-12.' },
        { status: 400 }
      );
    }

    // Validate year
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Tahun tidak valid.' },
        { status: 400 }
      );
    }

    const { startOfMonth, endOfMonth } = getMonthRange(month, year);

    const transactions = await db.transaction.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
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
