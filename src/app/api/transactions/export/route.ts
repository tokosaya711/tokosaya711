import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const body = await request.json();
    const { startDate, endDate, paymentMethod, search } = body;

    // Build where clause (same filter logic as GET in /api/transactions)
    const where: Record<string, unknown> = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    if (search) {
      where.invoiceNumber = { contains: search };
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    // Fetch all matching transactions with items (no pagination - export all)
    const transactions = await db.transaction.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'Tidak ada transaksi untuk diekspor' }, { status: 404 });
    }

    // Collect exported transaction IDs for deletion after export
    const exportedIds = transactions.map((t) => t.id);

    // Build "Transaksi" sheet data
    const transaksiData = transactions.map((t) => ({
      invoiceNumber: t.invoiceNumber,
      tanggal: t.createdAt.toISOString().split('T')[0],
      kasir: t.user?.name || '-',
      customer: t.customer?.name || '-',
      metodePembayaran: t.paymentMethod,
      subtotal: t.subtotal,
      diskon: t.discount,
      pajak: t.tax,
      total: t.total,
      dibayar: t.amountPaid,
      kembalian: t.change,
    }));

    // Build "Item Penjualan" sheet data
    const itemData: Array<{
      invoiceNumber: string;
      productName: string;
      quantity: number;
      productPrice: number;
      subtotal: number;
    }> = [];

    for (const t of transactions) {
      for (const item of t.items) {
        itemData.push({
          invoiceNumber: t.invoiceNumber,
          productName: item.productName,
          quantity: item.quantity,
          productPrice: item.productPrice,
          subtotal: item.subtotal,
        });
      }
    }

    // Create workbook with two sheets
    const wb = XLSX.utils.book_new();

    const wsTransaksi = XLSX.utils.json_to_sheet(transaksiData);
    XLSX.utils.book_append_sheet(wb, wsTransaksi, 'Transaksi');

    const wsItem = XLSX.utils.json_to_sheet(itemData);
    XLSX.utils.book_append_sheet(wb, wsItem, 'Item Penjualan');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // After successful export, delete all exported transactions
    // TransactionItems will be cascade-deleted via onDelete: Cascade
    await db.transaction.deleteMany({
      where: {
        id: { in: exportedIds },
      },
    });

    // Generate filename with today's date
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `penjualan_${today}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
