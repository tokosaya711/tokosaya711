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
    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true, address: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    if (transaction.userId !== userId) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(transaction);
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

    // Check permission via feature matrix
    const canEdit = await checkFeatureAccess(role, 'transaction_edit');
    if (!canEdit) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengedit transaksi.' }, { status: 403 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await db.transaction.findUnique({ where: { id }, select: { userId: true } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.paymentMethod !== undefined) {
      updateData.paymentMethod = body.paymentMethod;
    }

    // Handle customer name change - find or create customer
    if (body.customerName !== undefined) {
      const customerName = body.customerName.trim();
      if (customerName) {
        // Try to find existing customer by name
        let customer = await db.customer.findFirst({
          where: { name: customerName, ownerId: userId },
        });
        if (!customer) {
          customer = await db.customer.create({
            data: { name: customerName, ownerId: userId },
          });
        }
        updateData.customerId = customer.id;
      } else {
        // Clear customer
        updateData.customerId = null;
      }
    }

    // Update the transaction
    const transaction = await db.transaction.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('[transactions PUT]', error);
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

    // Check permission via feature matrix (admin always has access)
    const canDelete = await checkFeatureAccess(role, 'transaction_delete');
    if (!canDelete) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk menghapus transaksi.' }, { status: 403 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await db.transaction.findUnique({ where: { id }, select: { userId: true } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    // Delete transaction items first (cascade), then the transaction
    await db.transactionItem.deleteMany({
      where: { transactionId: id },
    });

    await db.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Transaksi berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
