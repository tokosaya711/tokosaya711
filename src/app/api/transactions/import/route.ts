import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse workbook
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Get the "Transaksi" sheet
    const wsTransaksi = wb.Sheets['Transaksi'];
    if (!wsTransaksi) {
      return NextResponse.json({ error: 'Sheet "Transaksi" tidak ditemukan' }, { status: 400 });
    }

    // Get the "Item Penjualan" sheet
    const wsItem = wb.Sheets['Item Penjualan'];
    if (!wsItem) {
      return NextResponse.json({ error: 'Sheet "Item Penjualan" tidak ditemukan' }, { status: 400 });
    }

    // Parse both sheets to JSON arrays
    const transaksiRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wsTransaksi);
    const itemRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wsItem);

    if (transaksiRows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data transaksi untuk diimpor' }, { status: 400 });
    }

    // Collect existing invoice numbers to detect duplicates (only this user's)
    const existingInvoices = await db.transaction.findMany({
      where: { userId },
      select: { invoiceNumber: true },
    });
    const existingInvoiceSet = new Set(existingInvoices.map((inv) => inv.invoiceNumber));

    let importedCount = 0;
    let skippedCount = 0;

    // Group items by invoice number
    const itemsByInvoice = new Map<string, Array<Record<string, unknown>>>();
    for (const item of itemRows) {
      const invoiceNumber = String(item.invoiceNumber || '').trim();
      if (!invoiceNumber) continue;
      if (!itemsByInvoice.has(invoiceNumber)) {
        itemsByInvoice.set(invoiceNumber, []);
      }
      itemsByInvoice.get(invoiceNumber)!.push(item);
    }

    // Get a default category for placeholder products (belonging to this user)
    const defaultCategory = await db.category.findFirst({
      where: { ownerId: userId },
    });
    if (!defaultCategory) {
      return NextResponse.json({ error: 'Kategori produk tidak ditemukan. Buat setidaknya satu kategori terlebih dahulu.' }, { status: 400 });
    }

    // Process each transaction row
    for (const row of transaksiRows) {
      const invoiceNumber = String(row.invoiceNumber || '').trim();
      if (!invoiceNumber) continue;

      // Skip duplicate invoice numbers
      if (existingInvoiceSet.has(invoiceNumber)) {
        skippedCount++;
        continue;
      }

      const customerName = String(row.customer || '').trim();
      const tanggal = String(row.tanggal || '').trim();
      const kasir = String(row.kasir || '').trim();
      const metodePembayaran = String(row.metodePembayaran || '').trim();

      const subtotal = Number(row.subtotal) || 0;
      const diskon = Number(row.diskon) || 0;
      const pajak = Number(row.pajak) || 0;
      const total = Number(row.total) || 0;
      const dibayar = Number(row.dibayar) || 0;
      const kembalian = Number(row.kembalian) || 0;

      // Find or use current user as userId
      let txUserId = userId;
      if (kasir && kasir !== '-') {
        const existingUser = await db.user.findFirst({
          where: { name: kasir },
        });
        if (existingUser) {
          txUserId = existingUser.id;
        }
      }

      // Find or create customer
      let customerId: string | null = null;
      if (customerName && customerName !== '-') {
        const existingCustomer = await db.customer.findFirst({
          where: { name: customerName, ownerId: userId },
        });
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = await db.customer.create({
            data: { name: customerName, ownerId: userId },
          });
          customerId = newCustomer.id;
        }
      }

      // Get items for this invoice
      const invoiceItems = itemsByInvoice.get(invoiceNumber) || [];

      // Build transaction items data
      const itemsData: Array<{
        productId: string;
        productName: string;
        productPrice: number;
        quantity: number;
        subtotal: number;
      }> = [];

      for (const item of invoiceItems) {
        const productName = String(item.productName || '').trim();
        const quantity = Number(item.quantity) || 0;
        const productPrice = Number(item.productPrice) || 0;
        const itemSubtotal = Number(item.subtotal) || 0;

        if (!productName || quantity <= 0) continue;

        // Try to find existing product by name
        const existingProduct = await db.product.findFirst({
          where: { name: productName, ownerId: userId },
        });

        if (existingProduct) {
          itemsData.push({
            productId: existingProduct.id,
            productName: existingProduct.name,
            productPrice: existingProduct.price,
            quantity,
            subtotal: existingProduct.price * quantity,
          });
        } else {
          // Create a placeholder product
          const placeholderProduct = await db.product.create({
            data: {
              name: productName,
              price: productPrice > 0 ? productPrice : 0,
              stock: 0,
              categoryId: defaultCategory.id,
              ownerId: userId,
              isActive: true,
            },
          });
          itemsData.push({
            productId: placeholderProduct.id,
            productName: placeholderProduct.name,
            productPrice: placeholderProduct.price,
            quantity,
            subtotal: placeholderProduct.price * quantity,
          });
        }
      }

      // Parse the transaction date if provided
      const createdAt = tanggal ? new Date(tanggal) : new Date();

      // Create the transaction record
      await db.transaction.create({
        data: {
          invoiceNumber,
          userId: txUserId,
          customerId,
          subtotal,
          discount: diskon,
          tax: pajak,
          total,
          paymentMethod: metodePembayaran || 'Tunai',
          amountPaid: dibayar,
          change: kembalian,
          createdAt,
          items: {
            create: itemsData,
          },
        },
      });

      importedCount++;
      existingInvoiceSet.add(invoiceNumber);
    }

    return NextResponse.json({
      message: `Berhasil mengimpor ${importedCount} transaksi${skippedCount > 0 ? `, ${skippedCount} dilewati (duplikat)` : ''}`,
      importedCount,
      skippedCount,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
