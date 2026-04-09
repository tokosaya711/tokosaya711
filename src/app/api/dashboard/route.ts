import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const { userId } = auth.user;

    // Today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Fetch today's transactions and last 7 days data in parallel
    const [todayTransactions, last7DaysTransactions, productCount] = await Promise.all([
      // Today's sales data
      db.transaction.findMany({
        where: { createdAt: { gte: todayStart, lt: todayEnd }, userId },
        include: { items: true },
      }),
      // Last 7 days data for chart
      db.transaction.findMany({
        where: {
          createdAt: {
            gte: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000),
          },
          userId,
        },
        select: {
          total: true,
          createdAt: true,
        },
      }),
      // Total active products
      db.product.count({ where: { isActive: true, ownerId: userId } }),
    ]);

    // Calculate today's stats
    const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);
    const todayTransactionCount = todayTransactions.length;

    // Best sellers from today's transactions
    const productSalesMap = new Map<string, { name: string; total: number; revenue: number }>();
    for (const transaction of todayTransactions) {
      for (const item of transaction.items) {
        const existing = productSalesMap.get(item.productName);
        if (existing) {
          existing.total += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          productSalesMap.set(item.productName, {
            name: item.productName,
            total: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }
    const bestSellers = Array.from(productSalesMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Daily sales for last 7 days
    const dailySalesMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().slice(0, 10);
      dailySalesMap.set(dateKey, 0);
    }

    for (const transaction of last7DaysTransactions) {
      const dateKey = transaction.createdAt.toISOString().slice(0, 10);
      const existing = dailySalesMap.get(dateKey);
      if (existing !== undefined) {
        dailySalesMap.set(dateKey, existing + transaction.total);
      }
    }

    const dailySales = Array.from(dailySalesMap.entries()).map(([date, total]) => ({
      date,
      total,
    }));

    return NextResponse.json({
      todaySales,
      todayTransactions: todayTransactionCount,
      todayProducts: productCount,
      bestSellers,
      dailySales,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
