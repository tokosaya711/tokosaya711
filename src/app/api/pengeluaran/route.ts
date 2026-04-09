import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

const VALID_CATEGORIES = [
  'gaji_karyawan',
  'listrik',
  'air',
  'keamanan',
  'kebersihan',
  'sewa_tempat',
  'service_charge',
  'transportasi',
  'lain_lain',
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId } = auth.user;

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    if (!monthParam || !yearParam) {
      return NextResponse.json({ error: 'Parameter month dan year wajib diisi' }, { status: 400 });
    }

    const month = parseInt(monthParam, 10);
    const year = parseInt(yearParam, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Month harus berupa angka antara 1-12' }, { status: 400 });
    }

    if (isNaN(year) || year <= 0) {
      return NextResponse.json({ error: 'Year harus berupa angka yang valid' }, { status: 400 });
    }

    const expenses = await db.operationalExpense.findMany({
      where: {
        ownerId: userId,
        month,
        year,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('[pengeluaran GET] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId } = auth.user;

    const body = await request.json();
    const { category, name, amount, month, year } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Category tidak valid. Pilihan: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount harus berupa angka dan lebih dari 0' }, { status: 400 });
    }

    if (typeof month !== 'number' || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Month harus berupa angka antara 1-12' }, { status: 400 });
    }

    if (typeof year !== 'number' || year <= 0) {
      return NextResponse.json({ error: 'Year harus berupa angka dan lebih dari 0' }, { status: 400 });
    }

    const expense = await db.operationalExpense.create({
      data: {
        ownerId: userId,
        category,
        name: (name || '').trim(),
        amount: Math.round(amount),
        month,
        year,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('[pengeluaran POST] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId } = auth.user;

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID pengeluaran wajib diisi' }, { status: 400 });
    }

    // Verify the expense belongs to the authenticated user before deleting
    const existingExpense = await db.operationalExpense.findUnique({
      where: { id },
    });

    if (!existingExpense) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 });
    }

    if (existingExpense.ownerId !== userId) {
      return NextResponse.json({ error: 'Anda tidak memiliki izin untuk menghapus pengeluaran ini' }, { status: 403 });
    }

    await db.operationalExpense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Pengeluaran berhasil dihapus' });
  } catch (error) {
    console.error('[pengeluaran DELETE] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
