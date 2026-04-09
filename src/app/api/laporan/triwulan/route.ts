import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId } = auth.user;

    const { searchParams } = new URL(request.url);
    const quarterParam = searchParams.get('quarter');
    const yearParam = searchParams.get('year');

    const now = new Date();
    const quarter = quarterParam ? parseInt(quarterParam, 10) : Math.ceil((now.getMonth() + 1) / 3);
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    if (isNaN(quarter) || quarter < 1 || quarter > 4) {
      return NextResponse.json(
        { error: 'Triwulan harus berupa angka antara 1-4.' },
        { status: 400 }
      );
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Tahun tidak valid.' },
        { status: 400 }
      );
    }

    // Calculate quarter date range
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const startOfQuarter = new Date(year, startMonth - 1, 1, 0, 0, 0, 0);
    const endOfQuarter = new Date(year, endMonth, 0, 23, 59, 59, 999);

    const transactions = await db.transaction.findMany({
      where: {
        createdAt: {
          gte: startOfQuarter,
          lte: endOfQuarter,
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

    // Fetch current capital prices from Product table
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

    // Group by month
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthlyBreakdown: { month: number; monthName: string; totalTransactions: number; totalPenjualan: number; totalModal: number; profit: number }[] = [];

    for (let m = startMonth; m <= endMonth; m++) {
      const monthStart = new Date(year, m - 1, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, m, 0, 23, 59, 59, 999);
      const monthTxs = transactions.filter(tx => tx.createdAt >= monthStart && tx.createdAt <= monthEnd);

      const mPenjualan = monthTxs.reduce((s, tx) => s + tx.total, 0);
      let mModal = 0;
      for (const tx of monthTxs) {
        for (const item of tx.items) {
          const cp = productPrices.get(item.productId) || 0;
          mModal += cp * item.quantity;
        }
      }

      monthlyBreakdown.push({
        month: m,
        monthName: monthNames[m - 1],
        totalTransactions: monthTxs.length,
        totalPenjualan: Math.round(mPenjualan),
        totalModal: Math.round(mModal),
        profit: Math.round(mPenjualan - mModal),
      });
    }

    return NextResponse.json({
      transactions,
      summary: {
        totalTransactions,
        totalPenjualan: Math.round(totalPenjualan),
        totalModal: Math.round(totalModal),
        profit: Math.round(profit),
      },
      monthlyBreakdown,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
