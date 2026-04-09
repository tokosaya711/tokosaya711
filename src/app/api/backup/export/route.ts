import { authenticateRequest, hasAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    if (!hasAccess(role, ['admin'])) {
      return NextResponse.json({ error: 'Hanya admin yang dapat melakukan backup' }, { status: 403 });
    }

    const ownerId = userId;

    const [
      categories,
      products,
      customers,
      transactions,
      transactionItems,
      karyawan,
      settings,
    ] = await Promise.all([
      db.category.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } }),
      db.product.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } }),
      db.customer.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } }),
      db.transaction.findMany({
        where: { userId: ownerId },
        orderBy: { createdAt: 'desc' },
      }),
      db.transactionItem.findMany({
        where: { transaction: { userId: ownerId } },
      }),
      db.karyawan.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } }),
      db.storeSettings.findMany({ where: { ownerId } }),
    ]);

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Info ──
    const infoData = [
      ['Backup Data POS System'],
      ['Tanggal Backup', new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' })],
      ['Oleh', auth.user.name || auth.user.username || auth.user.email],
      ['Jumlah Kategori', categories.length],
      ['Jumlah Produk', products.length],
      ['Jumlah Customer', customers.length],
      ['Jumlah Transaksi', transactions.length],
      ['Jumlah Item Transaksi', transactionItems.length],
      ['Jumlah Karyawan', karyawan.length],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
    wsInfo['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Info Backup');

    // ── Sheet 2: Kategori ──
    if (categories.length > 0) {
      const catData = categories.map((c, i) => ({
        No: i + 1,
        ID: c.id,
        Nama: c.name,
        Tipe: c.type,
        Dibuat: c.createdAt.toISOString(),
      }));
      const ws = XLSX.utils.json_to_sheet(catData);
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 25 }, { wch: 10 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Kategori');
    }

    // ── Sheet 3: Produk ──
    if (products.length > 0) {
      const prodData = products.map((p, i) => ({
        No: i + 1,
        ID: p.id,
        Nama: p.name,
        'Harga Jual': p.price,
        'Harga Modal': p.capitalPrice,
        Stok: p.stock,
        'Status Stok': p.stockStatus,
        'Kategori ID': p.categoryId,
        Aktif: p.isActive ? 'Ya' : 'Tidak',
        Dibuat: p.createdAt.toISOString(),
      }));
      const ws = XLSX.utils.json_to_sheet(prodData);
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 7 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Produk');
    }

    // ── Sheet 4: Customer ──
    if (customers.length > 0) {
      const custData = customers.map((c, i) => ({
        No: i + 1,
        ID: c.id,
        Nama: c.name,
        Telepon: c.phone || '',
        Alamat: c.address || '',
        Catatan: c.notes || '',
        Dibuat: c.createdAt.toISOString(),
      }));
      const ws = XLSX.utils.json_to_sheet(custData);
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 25 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Customer');
    }

    // ── Sheet 5: Transaksi ──
    if (transactions.length > 0) {
      const txData = transactions.map((t, i) => ({
        No: i + 1,
        ID: t.id,
        'No Invoice': t.invoiceNumber,
        'Customer ID': t.customerId || '',
        Subtotal: t.subtotal,
        Diskon: t.discount,
        Pajak: t.tax,
        Total: t.total,
        'Metode Bayar': t.paymentMethod,
        Dibayar: t.amountPaid,
        Kembalian: t.change,
        Tanggal: t.createdAt.toISOString(),
      }));
      const ws = XLSX.utils.json_to_sheet(txData);
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    }

    // ── Sheet 6: Item Transaksi ──
    if (transactionItems.length > 0) {
      const itemData = transactionItems.map((item, i) => ({
        No: i + 1,
        ID: item.id,
        'Transaksi ID': item.transactionId,
        'Produk ID': item.productId,
        'Nama Produk': item.productName,
        Harga: item.productPrice,
        Jumlah: item.quantity,
        Subtotal: item.subtotal,
      }));
      const ws = XLSX.utils.json_to_sheet(itemData);
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 25 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Item Transaksi');
    }

    // ── Sheet 7: Karyawan ──
    if (karyawan.length > 0) {
      const karData = karyawan.map((k, i) => ({
        No: i + 1,
        ID: k.id,
        Bagian: k.bagian,
        'Total Gaji': k.totalGaji,
        'Uang Makan': k.totalUangMakan,
        'Mulai Bekerja': k.mulaiBekerja,
        Dibuat: k.createdAt.toISOString(),
      }));
      const ws = XLSX.utils.json_to_sheet(karData);
      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Karyawan');
    }

    // ── Sheet 8: Pengaturan Toko ──
    if (settings.length > 0) {
      const s = settings[0];
      const setData = [
        ['Pengaturan', 'Nilai'],
        ['Nama Toko', s.storeName],
        ['Alamat', s.address],
        ['Telepon', s.phone],
        ['Tarif Pajak (%)', s.taxRate],
        ['Footer Struk', s.receiptFooter],
        ['Periode Demo (hari)', s.demoPeriodDays],
        ['Pesan Popup Demo', s.demoPopupMessage],
        ['Auto Logout (menit)', s.autoLogoutMinutes],
        ['Peringatan Logout (detik)', s.logoutWarningSeconds],
        ['Login Satu Perangkat', s.singleDeviceLogin ? 'Ya' : 'Tidak'],
        ['Jumlah Karyawan', s.jumlahKaryawan],
        ['Gaji Per Karyawan', s.gajiPerKaryawan],
        ['Biaya Listrik', s.biayaListrik],
        ['Biaya Sewa', s.biayaSewa],
        ['Biaya Air', s.biayaAir],
        ['Biaya Transportasi', s.biayaTransportasi],
        ['Biaya Keamanan', s.biayaKeamanan],
        ['Biaya Kebersihan', s.biayaKebersihan],
        ['Biaya Service Charge', s.biayaServiceCharge],
        ['Biaya Lain-lain', s.biayaLainLain],
        ['Features (JSON)', s.features],
        ['Custom Roles (JSON)', s.customRoles],
      ];
      const ws = XLSX.utils.aoa_to_sheet(setData);
      ws['!cols'] = [{ wch: 28 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Pengaturan Toko');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `backup_pos_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[BACKUP EXPORT] Error:', error);
    return NextResponse.json({ error: 'Gagal melakukan backup' }, { status: 500 });
  }
}
