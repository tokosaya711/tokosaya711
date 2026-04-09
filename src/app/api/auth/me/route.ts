import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const userData = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
        demoExpiresAt: true,
        createdAt: true,
      },
    });

    if (!userData || !userData.isActive) {
      return NextResponse.json({ error: 'Akun tidak ditemukan, silakan login ulang' }, { status: 401 });
    }

    return NextResponse.json({
      ...userData,
      demoExpiresAt: userData.demoExpiresAt ? userData.demoExpiresAt.toISOString() : null,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
