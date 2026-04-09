import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

function getDefaultDateRange() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
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

    // Fetch all transactions in date range
    const transactions = await db.transaction.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        userId,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily breakdown
    const dailyMap = new Map<string, {
      date: string;
      pendapatan: number;
      diskon: number;
      pajak: number;
      labaKotor: number;
      transactionCount: number;
    }>();

    let totalPendapatan = 0;
    let totalDiskon = 0;
    let totalPajak = 0;
    let labaKotor = 0;

    for (const tx of transactions) {
      // Extract date string (YYYY-MM-DD) from createdAt
      const txDate = new Date(tx.createdAt);
      const dateStr = formatDateStr(txDate);

      // Accumulate totals
      totalPendapatan += tx.subtotal;
      totalDiskon += tx.discount;
      totalPajak += tx.tax;
      // Laba kotor = subtotal - diskon + pajak (which equals total)
      labaKotor += tx.total;

      // Accumulate daily
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.pendapatan += tx.subtotal;
        existing.diskon += tx.discount;
        existing.pajak += tx.tax;
        existing.labaKotor += tx.total;
        existing.transactionCount += 1;
      } else {
        dailyMap.set(dateStr, {
          date: dateStr,
          pendapatan: tx.subtotal,
          diskon: tx.discount,
          pajak: tx.tax,
          labaKotor: tx.total,
          transactionCount: 1,
        });
      }
    }

    // Convert map to sorted array by date
    const dailyBreakdown = Array.from(dailyMap.values())
      .map((entry) => ({
        ...entry,
        pendapatan: Math.round(entry.pendapatan),
        diskon: Math.round(entry.diskon),
        pajak: Math.round(entry.pajak),
        labaKotor: Math.round(entry.labaKotor),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      summary: {
        totalPendapatan: Math.round(totalPendapatan),
        totalDiskon: Math.round(totalDiskon),
        totalPajak: Math.round(totalPajak),
        labaKotor: Math.round(labaKotor),
      },
      dailyBreakdown,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
