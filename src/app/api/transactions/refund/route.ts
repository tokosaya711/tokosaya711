import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // 2. Parse body
    const body = await request.json();
    const { transactionId, reason } = body;

    if (!transactionId || !reason) {
      return NextResponse.json({ error: 'Transaction ID dan alasan wajib diisi' }, { status: 400 });
    }

    // 3. Check transaction exists
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    // Verify ownership
    if (transaction.userId !== userId) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    // 4. Return success (refund is tracked client-side for now)
    return NextResponse.json({
      success: true,
      message: 'Retur berhasil diproses',
      invoiceNumber: transaction.invoiceNumber
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json({ error: 'Gagal memproses retur' }, { status: 500 });
  }
}
