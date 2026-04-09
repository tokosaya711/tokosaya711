import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Public endpoint — no auth required
// Only returns non-sensitive store info for login page and public display
export async function GET() {
  try {
    let settings = await db.storeSettings.findFirst();
    if (!settings) {
      const adminUser = await db.user.findFirst({ where: { role: 'admin', isActive: true }, select: { id: true } });
      const ownerId = adminUser?.id || 'default';
      settings = await db.storeSettings.create({ data: { ownerId } });
    }
    return NextResponse.json({
      storeName: settings.storeName,
      storeLogo: settings.storeLogo,
    });
  } catch {
    return NextResponse.json(
      { storeName: 'Sweet Bakery & Food', storeLogo: '' },
    );
  }
}
