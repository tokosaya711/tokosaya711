import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust so Monday is day 0
  return new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0);
}

function formatDateStr(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId } = auth.user;

    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get('weekStart');

    // Calculate weekStart (Monday 00:00)
    const now = new Date();
    const weekStart = weekStartParam
      ? new Date(weekStartParam)
      : getMonday(now);

    if (isNaN(weekStart.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Ensure weekStart is Monday
    const monday = getMonday(weekStart);
    const weekStartDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
    const weekEndDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    // Fetch all transactions in the week range
    const transactions = await db.transaction.findMany({
      where: {
        createdAt: {
          gte: weekStartDate,
          lte: weekEndDate,
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
              select: {
                id: true,
                name: true,
                capitalPrice: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Batch-fetch current capital prices from Product table
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

    // Calculate totals
    const totalTransactions = transactions.length;
    const totalPenjualan = transactions.reduce((sum, tx) => sum + tx.total, 0);

    let totalModal = 0;
    for (const tx of transactions) {
      for (const item of tx.items) {
        const capitalPrice = productPrices.get(item.productId) || 0;
        totalModal += capitalPrice * item.quantity;
      }
    }

    const profit = totalPenjualan - totalModal;

    // Build daily breakdown for all 7 days (Mon-Sun)
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + i,
        0, 0, 0, 0
      );
      const dayEnd = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + i,
        23, 59, 59, 999
      );
      const dateStr = formatDateStr(dayDate);
      const dayName = DAY_NAMES[dayDate.getDay()];

      // Filter transactions for this day
      const dayTxs = transactions.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return txDate >= dayDate && txDate <= dayEnd;
      });

      const dayTotalTx = dayTxs.length;
      const dayPenjualan = dayTxs.reduce((sum, tx) => sum + tx.total, 0);

      let dayModal = 0;
      for (const tx of dayTxs) {
        for (const item of tx.items) {
          const capitalPrice = productPrices.get(item.productId) || 0;
          dayModal += capitalPrice * item.quantity;
        }
      }

      const dayProfit = dayPenjualan - dayModal;

      dailyBreakdown.push({
        date: dateStr,
        dayName,
        totalTransactions: dayTotalTx,
        totalPenjualan: Math.round(dayPenjualan),
        totalModal: Math.round(dayModal),
        profit: Math.round(dayProfit),
      });
    }

    return NextResponse.json({
      weekStart: formatDateStr(weekStartDate),
      weekEnd: formatDateStr(weekEndDate),
      transactions,
      summary: {
        totalTransactions,
        totalPenjualan: Math.round(totalPenjualan),
        totalModal: Math.round(totalModal),
        profit: Math.round(profit),
      },
      dailyBreakdown,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
