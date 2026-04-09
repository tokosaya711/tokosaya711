import { NextRequest, NextResponse } from 'next/server';
import { authenticateByUsername } from '@/lib/auth';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    // Check if user still exists in the database
    const existingUser = await db.user.findUnique({ where: { username } });
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan. Akun Anda mungkin telah dihapus dari sistem.' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!existingUser.isActive) {
      return NextResponse.json(
        { error: 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.' },
        { status: 403 }
      );
    }

    // Check if demo account has expired
    if (existingUser.isDemo && existingUser.demoExpiresAt && new Date() > existingUser.demoExpiresAt) {
      return NextResponse.json(
        { error: 'Masa trial Anda telah berakhir. Silakan hubungi admin untuk upgrade akun.' },
        { status: 403 }
      );
    }

    // Check single-device login restriction
    // Always check the ADMIN's StoreSettings (same source of truth as settings API)
    // IMPORTANT: Admin users are NEVER blocked — they can override and kick any existing session
    let settingsOwnerId = existingUser.id;
    if (existingUser.role !== 'admin') {
      const adminUser = await db.user.findFirst({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      });
      if (adminUser) {
        settingsOwnerId = adminUser.id;
      }
    }
    const settings = await db.storeSettings.findFirst({ where: { ownerId: settingsOwnerId } });

    // Non-admin: block if already logged in elsewhere
    if (existingUser.role !== 'admin' && settings?.singleDeviceLogin && existingUser.activeSessionId) {
      return NextResponse.json(
        { error: 'Akun sudah digunakan. Silahkan logout di perangkat yang lain.', deviceConflict: true },
        { status: 403 }
      );
    }

    const result = await authenticateByUsername(username, password);
    if (!result) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    // If single-device login is enabled, save session ID (replaces any existing session)
    if (settings?.singleDeviceLogin) {
      const sessionId = randomUUID();
      await db.user.update({
        where: { id: existingUser.id },
        data: { activeSessionId: sessionId },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
