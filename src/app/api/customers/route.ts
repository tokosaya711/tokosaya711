import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      ownerId: userId,
    };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totalBelanja for each customer
    const customersWithTotal = await Promise.all(
      customers.map(async (customer) => {
        const result = await db.transaction.aggregate({
          where: { customerId: customer.id },
          _sum: { total: true },
        });
        return {
          ...customer,
          totalBelanja: result._sum.total || 0,
        };
      })
    );

    return NextResponse.json(customersWithTotal);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check feature permission from database
    const allowed = await checkFeatureAccess(role, 'customer_add');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk menambah pelanggan.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, address, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama pelanggan wajib diisi' }, { status: 400 });
    }

    const customer = await db.customer.create({
      data: {
        name,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        ownerId: userId,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
