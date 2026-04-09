import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'user_edit');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengedit pengguna.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, username, email, password, role: userRole, isActive, isDemo, demoExpiresAt, isPembeli, roles } = body;

    // If changing email, check for duplicates
    if (email) {
      const existingUser = await db.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existingUser) {
        return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 });
      }
    }

    // If changing username, check for duplicates
    if (username !== undefined && username.trim()) {
      const existingUsername = await db.user.findFirst({
        where: { username: username.trim(), NOT: { id } },
      });
      if (existingUsername) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username.trim();
    if (email !== undefined) updateData.email = email;
    if (userRole !== undefined) {
      updateData.role = userRole;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDemo !== undefined) updateData.isDemo = isDemo;
    if (isPembeli !== undefined) updateData.isPembeli = isPembeli;
    if (roles !== undefined) {
      updateData.roles = Array.isArray(roles) ? roles.join(',') : roles;
    }
    if (demoExpiresAt !== undefined) {
      updateData.demoExpiresAt = demoExpiresAt ? new Date(demoExpiresAt) : null;
    }

    // Hash password if provided
    if (password) {
      const bcrypt = await import('bcryptjs');
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        isDemo: true,
        demoExpiresAt: true,
        isPembeli: true,
        roles: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...updatedUser,
      demoExpiresAt: updatedUser.demoExpiresAt ? updatedUser.demoExpiresAt.toISOString() : null,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'user_delete');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk menghapus pengguna.' }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (userId === id) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });
    }

    // Reassign transactions to the current admin before deleting
    await db.transaction.updateMany({
      where: { userId: id },
      data: { userId },
    });

    const deletedUser = await db.user.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: 'Pengguna berhasil dihapus',
      user: deletedUser,
    });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
