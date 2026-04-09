import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasAccess } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Non-admin users: load the first active admin user's karyawan
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

    const karyawan = await db.karyawan.findMany({
      where: { ownerId: settingsOwnerId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        bagian: true,
        totalGaji: true,
        totalUangMakan: true,
        mulaiBekerja: true,
        createdAt: true,
      },
    });

    return NextResponse.json(karyawan);
  } catch (error) {
    console.error('[karyawan GET] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    if (!hasAccess(role, ['admin'])) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat menambah karyawan.' }, { status: 403 });
    }

    const body = await request.json();
    const { bagian, totalGaji, totalUangMakan, mulaiBekerja } = body;

    if (!bagian || !bagian.trim()) {
      return NextResponse.json({ error: 'Bagian wajib diisi' }, { status: 400 });
    }

    const karyawan = await db.karyawan.create({
      data: {
        bagian: bagian.trim(),
        totalGaji: Number(totalGaji) || 0,
        totalUangMakan: Number(totalUangMakan) || 0,
        mulaiBekerja: mulaiBekerja || '',
        ownerId: userId,
      },
    });

    return NextResponse.json(karyawan, { status: 201 });
  } catch (error) {
    console.error('[karyawan POST] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
