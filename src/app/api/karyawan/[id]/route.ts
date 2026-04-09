import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasAccess } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { role } = auth.user;

    if (!hasAccess(role, ['admin'])) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat mengubah data karyawan.' }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const { bagian, totalGaji, totalUangMakan, mulaiBekerja } = body;

    if (bagian !== undefined && !bagian.trim()) {
      return NextResponse.json({ error: 'Bagian wajib diisi' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (bagian !== undefined) data.bagian = bagian.trim();
    if (totalGaji !== undefined) data.totalGaji = Number(totalGaji) || 0;
    if (totalUangMakan !== undefined) data.totalUangMakan = Number(totalUangMakan) || 0;
    if (mulaiBekerja !== undefined) data.mulaiBekerja = mulaiBekerja || '';

    const karyawan = await db.karyawan.update({
      where: { id },
      data,
    });

    return NextResponse.json(karyawan);
  } catch (error) {
    console.error('[karyawan PUT] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { role } = auth.user;

    if (!hasAccess(role, ['admin'])) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat menghapus data karyawan.' }, { status: 403 });
    }

    const { id } = await params;

    await db.karyawan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[karyawan DELETE] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
