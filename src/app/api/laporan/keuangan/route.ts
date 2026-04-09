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
    const { userId } = auth.user;

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

    // Fetch all transactions in date range with items
    const transactions = await db.transaction.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        userId,
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, capitalPrice: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
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

    // Build daily breakdown
    const dailyMap = new Map<string, {
      date: string;
      pendapatan: number;
      diskon: number;
      pajak: number;
      totalModal: number;
      labaKotor: number;
      jumlahTransaksi: number;
    }>();

    let totalPendapatan = 0;
    let totalDiskon = 0;
    let totalPajak = 0;
    let totalModal = 0;

    for (const tx of transactions) {
      // Calculate modal for this transaction
      let txModal = 0;
      for (const item of tx.items) {
        const capitalPrice = productPrices.get(item.productId) || 0;
        txModal += capitalPrice * item.quantity;
      }

      const txPendapatan = tx.total; // actual money received
      const txLabaKotor = txPendapatan - txModal;

      // Accumulate totals
      totalPendapatan += txPendapatan;
      totalDiskon += tx.discount;
      totalPajak += tx.tax;
      totalModal += txModal;

      // Accumulate daily
      const txDate = new Date(tx.createdAt);
      const dateStr = formatDateStr(txDate);
      const existing = dailyMap.get(dateStr);

      if (existing) {
        existing.pendapatan += txPendapatan;
        existing.diskon += tx.discount;
        existing.pajak += tx.tax;
        existing.totalModal += txModal;
        existing.labaKotor += txLabaKotor;
        existing.jumlahTransaksi += 1;
      } else {
        dailyMap.set(dateStr, {
          date: dateStr,
          pendapatan: txPendapatan,
          diskon: tx.discount,
          pajak: tx.tax,
          totalModal: txModal,
          labaKotor: txLabaKotor,
          jumlahTransaksi: 1,
        });
      }
    }

    const labaKotor = totalPendapatan - totalModal;

    // Convert map to sorted array by date
    const dailyBreakdown = Array.from(dailyMap.values())
      .map((entry) => ({
        date: entry.date,
        pendapatan: Math.round(entry.pendapatan),
        diskon: Math.round(entry.diskon),
        pajak: Math.round(entry.pajak),
        totalModal: Math.round(entry.totalModal),
        labaKotor: Math.round(entry.labaKotor),
        jumlahTransaksi: entry.jumlahTransaksi,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalPendapatan: Math.round(totalPendapatan),
      totalDiskon: Math.round(totalDiskon),
      totalPajak: Math.round(totalPajak),
      totalModal: Math.round(totalModal),
      labaKotor: Math.round(labaKotor),
      dailyBreakdown,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
