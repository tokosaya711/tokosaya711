import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check feature permission for viewing transactions
    const allowed = await checkFeatureAccess(role, 'transactions');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk melihat riwayat transaksi.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 20;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const paymentMethod = searchParams.get('paymentMethod');

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

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Allow any authenticated user to create transactions (POS is accessible to all)

    const body = await request.json();
    const { customerId, discount, tax, paymentMethod, amountPaid, items } = body;

    if (!paymentMethod || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Metode pembayaran dan item wajib diisi' },
        { status: 400 }
      );
    }

    // Get product details and validate
    const productIds = items.map((item: { productId: string }) => item.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, ownerId: userId },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Beberapa produk tidak ditemukan' }, { status: 400 });
    }

    // Validate stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `Produk ${product?.name || item.productId} tidak tersedia` },
          { status: 400 }
        );
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Stok ${product.name} tidak mencukupi (tersisa: ${product.stock})` },
          { status: 400 }
        );
      }
    }

    // Calculate subtotal
    const subtotal = items.reduce((sum: number, item: { productId: string; quantity: number }) => {
      const product = products.find((p) => p.id === item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    const discountAmount = Number(discount) || 0;
    const taxAmount = Number(tax) || 0;
    const total = subtotal - discountAmount + taxAmount;
    const paidAmount = Number(amountPaid) || 0;
    const change = paidAmount - total;

    // Generate invoice number: INV-YYMMDD-XXXX (daily auto-increment, 4 digits)
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `INV-${yy}${mm}${dd}`;

    const lastTxToday = await db.transaction.findFirst({
      where: {
        invoiceNumber: { startsWith: datePrefix },
      },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    let nextSeq = 1;
    if (lastTxToday?.invoiceNumber) {
      const lastSeq = parseInt(lastTxToday.invoiceNumber.slice(-4), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    const invoiceNumber = `${datePrefix}-${String(nextSeq).padStart(4, '0')}`;

    // Use a transaction to ensure atomicity
    const transaction = await db.$transaction(async (tx) => {
      // Deduct stock for each product
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Create transaction with items
      return tx.transaction.create({
        data: {
          invoiceNumber,
          userId,
          customerId: customerId || null,
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          total,
          paymentMethod,
          amountPaid: paidAmount,
          change,
          items: {
            create: items.map((item: { productId: string; quantity: number }) => {
              const product = products.find((p) => p.id === item.productId)!;
              return {
                productId: item.productId,
                productName: product.name,
                productPrice: product.price,
                quantity: item.quantity,
                subtotal: product.price * item.quantity,
              };
            }),
          },
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
          customer: {
            select: { id: true, name: true, phone: true },
          },
          items: true,
        },
      });
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
