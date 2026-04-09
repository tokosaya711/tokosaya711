import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const { oldPassword, newPassword, targetUserId } = await request.json();

    // Admin reset password for another user (no old password needed)
    if (payload.role === 'admin' && targetUserId) {
      if (!newPassword) {
        return NextResponse.json(
          { error: 'Password baru wajib diisi' },
          { status: 400 }
        );
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password baru minimal 6 karakter' },
          { status: 400 }
        );
      }

      // Verify target user exists
      const targetUser = await db.user.findUnique({
        where: { id: targetUserId },
      });
      if (!targetUser) {
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
      }

      // Prevent admin from resetting their own password via this method
      if (targetUserId === payload.userId) {
        return NextResponse.json(
          { error: 'Gunakan menu ubah password untuk mengubah password sendiri' },
          { status: 400 }
        );
      }

      // Hash new password and update
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.user.update({
        where: { id: targetUserId },
        data: { password: hashedPassword },
      });

      return NextResponse.json({ message: `Password user "${targetUser.name}" berhasil direset` });
    }

    // Regular user changing their own password
    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password lama dan password baru wajib diisi' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
        { status: 400 }
      );
    }

    // Find user with password
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Verify old password
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 401 });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: 'Password berhasil diubah' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
