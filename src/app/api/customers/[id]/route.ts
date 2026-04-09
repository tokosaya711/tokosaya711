import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        transactions: {
          include: {
            user: {
              select: { id: true, name: true },
            },
            items: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer || customer.ownerId !== userId) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    // Calculate totalBelanja
    const totalResult = await db.transaction.aggregate({
      where: { customerId: id },
      _sum: { total: true },
    });
    const totalBelanja = totalResult._sum.total || 0;

    return NextResponse.json({ ...customer, totalBelanja });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'customer_edit');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengedit pelanggan.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, phone, address, notes } = body;

    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'customer_delete');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk menghapus pelanggan.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    await db.customer.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Pelanggan berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
