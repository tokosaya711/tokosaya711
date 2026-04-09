import { authenticateRequest, hasAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    if (!hasAccess(role, ['admin'])) {
      return NextResponse.json({ error: 'Hanya admin yang dapat melakukan restore' }, { status: 403 });
    }

    const ownerId = userId;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Format file harus .xlsx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });

    const sheetNames = wb.SheetNames;

    let restored: Record<string, number> = {};

    // ── Helper: read sheet as array of objects ──
    function readSheet<T>(name: string): T[] {
      const idx = sheetNames.indexOf(name);
      if (idx === -1) return [];
      const ws = wb.Sheets[sheetNames[idx]];
      return XLSX.utils.sheet_to_json<T>(ws, { defval: '' });
    }

    function readSheetAOA(name: string): (string | number | boolean)[][] {
      const idx = sheetNames.indexOf(name);
      if (idx === -1) return [];
      const ws = wb.Sheets[sheetNames[idx]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    }

    // ── 1. Restore Categories ──
    const catRows = readSheet<{ No: number | string; ID: string; Nama: string; Tipe: string; Dibuat: string }>('Kategori');
    if (catRows.length > 0) {
      // Build ID map for reference resolution
      const oldToNewCatId: Record<string, string> = {};
      for (const row of catRows) {
        const oldId = String(row.ID || '');
        if (!oldId || !row.Nama) continue;
        const existing = await db.category.findFirst({ where: { ownerId, name: row.Nama, type: String(row.Tipe || 'cake') } });
        let newId: string;
        if (existing) {
          newId = existing.id;
          await db.category.update({ where: { id: existing.id }, data: { name: row.Nama, type: String(row.Tipe || 'cake') } });
        } else {
          const created = await db.category.create({
            data: {
              name: row.Nama,
              type: String(row.Tipe || 'cake'),
              ownerId,
            },
          });
          newId = created.id;
        }
        oldToNewCatId[oldId] = newId;
      }
      restored['Kategori'] = catRows.length;

      // ── 2. Restore Products ──
      const prodRows = readSheet<{ ID: string; Nama: string; 'Harga Jual': number | string; 'Harga Modal': number | string; Stok: number | string; 'Status Stok': string; 'Kategori ID': string; Aktif: string }>('Produk');
      if (prodRows.length > 0) {
        const oldToNewProdId: Record<string, string> = {};
        for (const row of prodRows) {
          const oldId = String(row.ID || '');
          if (!oldId || !row.Nama) continue;
          const newCatId = oldToNewCatId[String(row['Kategori ID'] || '')] || '';
          if (!newCatId) continue;

          const existing = await db.product.findFirst({ where: { ownerId, name: row.Nama } });
          let newId: string;
          if (existing) {
            newId = existing.id;
            await db.product.update({
              where: { id: existing.id },
              data: {
                name: row.Nama,
                price: Number(row['Harga Jual']) || 0,
                capitalPrice: Number(row['Harga Modal']) || 0,
                stock: Number(row.Stok) || 0,
                stockStatus: String(row['Status Stok'] || ''),
                categoryId: newCatId,
                isActive: String(row.Aktif || 'Ya').toLowerCase() !== 'tidak',
              },
            });
          } else {
            const created = await db.product.create({
              data: {
                name: row.Nama,
                price: Number(row['Harga Jual']) || 0,
                capitalPrice: Number(row['Harga Modal']) || 0,
                stock: Number(row.Stok) || 0,
                stockStatus: String(row['Status Stok'] || ''),
                categoryId: newCatId,
                ownerId,
                isActive: String(row.Aktif || 'Ya').toLowerCase() !== 'tidak',
              },
            });
            newId = created.id;
          }
          oldToNewProdId[oldId] = newId;
        }
        restored['Produk'] = prodRows.length;

        // ── 3. Restore Customers ──
        const custRows = readSheet<{ ID: string; Nama: string; Telepon: string; Alamat: string; Catatan: string }>('Customer');
        const oldToNewCustId: Record<string, string> = {};
        if (custRows.length > 0) {
          for (const row of custRows) {
            const oldId = String(row.ID || '');
            if (!oldId || !row.Nama) continue;
            const existing = await db.customer.findFirst({ where: { ownerId, name: row.Nama } });
            let newId: string;
            if (existing) {
              newId = existing.id;
              await db.customer.update({
                where: { id: existing.id },
                data: {
                  name: row.Nama,
                  phone: String(row.Telepon || ''),
                  address: String(row.Alamat || ''),
                  notes: String(row.Catatan || ''),
                },
              });
            } else {
              const created = await db.customer.create({
                data: {
                  name: row.Nama,
                  phone: String(row.Telepon || ''),
                  address: String(row.Alamat || ''),
                  notes: String(row.Catatan || ''),
                  ownerId,
                },
              });
              newId = created.id;
            }
            oldToNewCustId[oldId] = newId;
          }
          restored['Customer'] = custRows.length;
        }

        // ── 4. Restore Transactions ──
        const txRows = readSheet<{ ID: string; 'No Invoice': string; 'Customer ID': string; Subtotal: number | string; Diskon: number | string; Pajak: number | string; Total: number | string; 'Metode Bayar': string; Dibayar: number | string; Kembalian: number | string; Tanggal: string }>('Transaksi');
        const oldToNewTxId: Record<string, string> = {};
        if (txRows.length > 0) {
          for (const row of txRows) {
            const oldId = String(row.ID || '');
            if (!oldId || !row['No Invoice']) continue;
            // Skip if invoice already exists
            const exists = await db.transaction.findUnique({ where: { invoiceNumber: row['No Invoice'] } });
            if (exists) {
              oldToNewTxId[oldId] = exists.id;
              continue;
            }
            const newCustId = oldToNewCustId[String(row['Customer ID'] || '')] || null;
            const txDate = row.Tanggal ? new Date(String(row.Tanggal)) : new Date();
            const created = await db.transaction.create({
              data: {
                invoiceNumber: row['No Invoice'],
                userId: ownerId,
                customerId: newCustId,
                subtotal: Number(row.Subtotal) || 0,
                discount: Number(row.Diskon) || 0,
                tax: Number(row.Pajak) || 0,
                total: Number(row.Total) || 0,
                paymentMethod: String(row['Metode Bayar'] || 'cash'),
                amountPaid: Number(row.Dibayar) || 0,
                change: Number(row.Kembalian) || 0,
                createdAt: txDate,
              },
            });
            oldToNewTxId[oldId] = created.id;
          }
          restored['Transaksi'] = txRows.length;

          // ── 5. Restore Transaction Items ──
          const itemRows = readSheet<{ ID: string; 'Transaksi ID': string; 'Produk ID': string; 'Nama Produk': string; Harga: number | string; Jumlah: number | string; Subtotal: number | string }>('Item Transaksi');
          if (itemRows.length > 0) {
            let itemCount = 0;
            for (const row of itemRows) {
              const newTxId = oldToNewTxId[String(row['Transaksi ID'] || '')];
              if (!newTxId) continue;
              const newProdId = oldToNewProdId[String(row['Produk ID'] || '')];
              if (!newProdId) continue;

              await db.transactionItem.create({
                data: {
                  transactionId: newTxId,
                  productId: newProdId,
                  productName: String(row['Nama Produk'] || ''),
                  productPrice: Number(row.Harga) || 0,
                  quantity: Number(row.Jumlah) || 1,
                  subtotal: Number(row.Subtotal) || 0,
                },
              });
              itemCount++;
            }
            restored['Item Transaksi'] = itemCount;
          }
        }
      }

      // ── 6. Restore Karyawan ──
      const karRows = readSheet<{ ID: string; Bagian: string; 'Total Gaji': number | string; 'Uang Makan': number | string; 'Mulai Bekerja': string }>('Karyawan');
      if (karRows.length > 0) {
        for (const row of karRows) {
          if (!row.Bagian) continue;
          const existing = await db.karyawan.findFirst({ where: { ownerId, bagian: row.Bagian } });
          if (existing) {
            await db.karyawan.update({
              where: { id: existing.id },
              data: {
                bagian: row.Bagian,
                totalGaji: Number(row['Total Gaji']) || 0,
                totalUangMakan: Number(row['Uang Makan']) || 0,
                mulaiBekerja: String(row['Mulai Bekerja'] || ''),
              },
            });
          } else {
            await db.karyawan.create({
              data: {
                bagian: row.Bagian,
                totalGaji: Number(row['Total Gaji']) || 0,
                totalUangMakan: Number(row['Uang Makan']) || 0,
                mulaiBekerja: String(row['Mulai Bekerja'] || ''),
                ownerId,
              },
            });
          }
        }
        restored['Karyawan'] = karRows.length;
      }

      // ── 7. Restore Store Settings ──
      const setRows = readSheetAOA('Pengaturan Toko');
      if (setRows.length > 1) {
        const settingsMap: Record<string, string> = {};
        for (let i = 1; i < setRows.length; i++) {
          const row = setRows[i];
          if (row[0] && row[1] !== undefined) {
            settingsMap[String(row[0])] = String(row[1]);
          }
        }

        const parseBool = (v: string) => v.toLowerCase() === 'ya' || v === 'true';
        const parseNum = (v: string) => parseFloat(v) || 0;

        const settingsData: Record<string, unknown> = {
          storeName: settingsMap['Nama Toko'] || '',
          address: settingsMap['Alamat'] || '',
          phone: settingsMap['Telepon'] || '',
          taxRate: parseNum(settingsMap['Tarif Pajak (%)']),
          receiptFooter: settingsMap['Footer Struk'] || '',
          demoPeriodDays: parseNum(settingsMap['Periode Demo (hari)']),
          demoPopupMessage: settingsMap['Pesan Popup Demo'] || '',
          autoLogoutMinutes: parseNum(settingsMap['Auto Logout (menit)']),
          logoutWarningSeconds: parseNum(settingsMap['Peringatan Logout (detik)']),
          singleDeviceLogin: parseBool(settingsMap['Login Satu Perangkat']),
          jumlahKaryawan: parseNum(settingsMap['Jumlah Karyawan']),
          gajiPerKaryawan: parseNum(settingsMap['Gaji Per Karyawan']),
          biayaListrik: parseNum(settingsMap['Biaya Listrik']),
          biayaSewa: parseNum(settingsMap['Biaya Sewa']),
          biayaAir: parseNum(settingsMap['Biaya Air']),
          biayaTransportasi: parseNum(settingsMap['Biaya Transportasi']),
          biayaKeamanan: parseNum(settingsMap['Biaya Keamanan']),
          biayaKebersihan: parseNum(settingsMap['Biaya Kebersihan']),
          biayaServiceCharge: parseNum(settingsMap['Biaya Service Charge']),
          biayaLainLain: parseNum(settingsMap['Biaya Lain-lain']),
        };

        if (settingsMap['Features (JSON)']) {
          try { settingsData.features = JSON.parse(settingsMap['Features (JSON)']); } catch {}
        }
        if (settingsMap['Custom Roles (JSON)']) {
          try { settingsData.customRoles = JSON.parse(settingsMap['Custom Roles (JSON)']); } catch {}
        }

        const existing = await db.storeSettings.findFirst({ where: { ownerId } });
        if (existing) {
          await db.storeSettings.update({ where: { id: existing.id }, data: settingsData });
        } else {
          await db.storeSettings.create({ data: { ...settingsData, ownerId } });
        }
        restored['Pengaturan Toko'] = 1;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Restore berhasil',
      restored,
    });
  } catch (error) {
    console.error('[BACKUP IMPORT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal melakukan restore' },
      { status: 500 }
    );
  }
}
