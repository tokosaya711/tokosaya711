import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasAccess } from '@/lib/auth';
import { db } from '@/lib/db';

const BIAYA_FIELDS = [
  'biayaListrik',
  'biayaSewa',
  'biayaAir',
  'biayaTransportasi',
  'biayaKeamanan',
  'biayaKebersihan',
  'biayaServiceCharge',
  'biayaLainLain',
] as const;

function buildBiayaResponse(settings: Record<string, unknown>, biayaGaji: number) {
  const biayaListrik = (settings.biayaListrik as number) || 0;
  const biayaSewa = (settings.biayaSewa as number) || 0;
  const biayaAir = (settings.biayaAir as number) || 0;
  const biayaTransportasi = (settings.biayaTransportasi as number) || 0;
  const biayaKeamanan = (settings.biayaKeamanan as number) || 0;
  const biayaKebersihan = (settings.biayaKebersihan as number) || 0;
  const biayaServiceCharge = (settings.biayaServiceCharge as number) || 0;
  const biayaLainLain = (settings.biayaLainLain as number) || 0;

  const totalBiayaOperasional =
    biayaGaji +
    biayaListrik +
    biayaSewa +
    biayaAir +
    biayaTransportasi +
    biayaKeamanan +
    biayaKebersihan +
    biayaServiceCharge +
    biayaLainLain;

  return {
    biayaListrik,
    biayaSewa,
    biayaAir,
    biayaTransportasi,
    biayaKeamanan,
    biayaKebersihan,
    biayaServiceCharge,
    biayaLainLain,
    biayaGaji,
    totalBiayaOperasional,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Non-admin users: load the first active admin user's StoreSettings
    let settingsOwnerId = userId;
    if (role !== 'admin') {
      const adminUser = await db.user.findFirst({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      });
      if (adminUser) {
        settingsOwnerId = adminUser.id;
      }
    }

    let settings = await db.storeSettings.findFirst({
      where: { ownerId: settingsOwnerId },
    });

    if (!settings) {
      try {
        settings = await db.storeSettings.create({
          data: { ownerId: settingsOwnerId },
        });
      } catch (createError) {
        console.error('[biaya GET] Create error:', createError);
        settings = await db.storeSettings.findFirst({
          where: { ownerId: settingsOwnerId },
        });
        if (!settings) {
          throw createError;
        }
      }
    }

    // Calculate biayaGaji from karyawan table
    const karyawanList = await db.karyawan.findMany({
      where: { ownerId: settingsOwnerId },
      select: { totalGaji: true, totalUangMakan: true },
    });
    const biayaGaji = karyawanList.reduce((sum, k) => sum + (k.totalGaji || 0) + (k.totalUangMakan || 0), 0);

    return NextResponse.json(buildBiayaResponse(settings, biayaGaji));
  } catch (error) {
    console.error('[biaya GET] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const { userId, role } = auth.user;

    // Only admin users can update biaya operasional
    if (!hasAccess(role, ['admin'])) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat mengubah biaya operasional.' }, { status: 403 });
    }

    const body = await request.json();

    // Validation
    for (const field of BIAYA_FIELDS) {
      if (body[field] !== undefined) {
        const val = Number(body[field]);
        if (isNaN(val) || val < 0) {
          return NextResponse.json({ error: `${field} harus berupa angka >= 0` }, { status: 400 });
        }
      }
    }

    // Build upsert data
    const data: Record<string, unknown> = {};
    for (const field of BIAYA_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = Number(body[field]);
      }
    }

    // Upsert: create or update the admin's StoreSettings
    const existing = await db.storeSettings.findFirst({
      where: { ownerId: userId },
    });

    let settings;
    if (existing) {
      settings = await db.storeSettings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      settings = await db.storeSettings.create({
        data: { ...data, ownerId: userId },
      });
    }

    // Calculate biayaGaji from karyawan table
    const karyawanList = await db.karyawan.findMany({
      where: { ownerId: userId },
      select: { totalGaji: true, totalUangMakan: true },
    });
    const biayaGaji = karyawanList.reduce((sum, k) => sum + (k.totalGaji || 0) + (k.totalUangMakan || 0), 0);

    return NextResponse.json(buildBiayaResponse(settings, biayaGaji));
  } catch (error) {
    console.error('[biaya PUT] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
