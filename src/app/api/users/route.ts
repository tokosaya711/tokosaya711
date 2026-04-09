import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkFeatureAccess } from '@/lib/feature-check';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'users');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isDemo: true,
        demoExpiresAt: true,
        isPembeli: true,
        roles: true,
        createdAt: true,
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format demoExpiresAt to ISO string
    const formattedUsers = users.map(u => ({
      ...u,
      demoExpiresAt: u.demoExpiresAt ? u.demoExpiresAt.toISOString() : null,
    }));

    return NextResponse.json(formattedUsers);
  } catch (err) {
    console.error('[GET /api/users] Error:', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    const allowed = await checkFeatureAccess(role, 'user_add');
    if (!allowed) {
      return NextResponse.json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk menambah pengguna.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, username, email, password, phone, role: userRole, isDemo, isPembeli, roles } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nama, email, dan password wajib diisi' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    }

    // Check if username already exists (if provided)
    if (username && username.trim()) {
      const existingUsername = await db.user.findUnique({ where: { username: username.trim() } });
      if (existingUsername) {
        return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 409 });
      }
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build user data
    const userData: Prisma.UserCreateInput = {
      name,
      username: username && username.trim() ? username.trim() : '',
      email,
      password: hashedPassword,
      role: userRole || 'cashier',
    };

    // Add phone if provided
    if (phone) {
      userData.phone = phone;
    }

    // Handle isPembeli
    if (isPembeli) {
      userData.isPembeli = true;
    }

    // Handle multi-role for pembeli
    if (roles !== undefined) {
      userData.roles = Array.isArray(roles) ? roles.join(',') : roles;
    }

    // Handle demo user creation
    if (isDemo) {
      userData.isDemo = true;
      // Get demo period from settings
      let settings = await db.storeSettings.findFirst();
      if (!settings) {
        settings = await db.storeSettings.create({ data: { ownerId: userId } });
      }
      const demoPeriodDays = settings.demoPeriodDays || 7;
      const demoExpiresAt = new Date();
      demoExpiresAt.setDate(demoExpiresAt.getDate() + demoPeriodDays);
      userData.demoExpiresAt = demoExpiresAt;
    }

    const newUser = await db.user.create({
      data: userData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
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
      ...newUser,
      demoExpiresAt: newUser.demoExpiresAt ? newUser.demoExpiresAt.toISOString() : null,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
