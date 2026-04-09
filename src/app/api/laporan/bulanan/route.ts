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
              select: { id: true, name: true, category: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalTransactions = transactions.length;
    const totalPenjualan = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const rataRata = totalTransactions > 0 ? Math.round(totalPenjualan / totalTransactions) : 0;

    return NextResponse.json({
      transactions,
      summary: {
        totalTransactions,
        totalPenjualan: Math.round(totalPenjualan),
        rataRata,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
