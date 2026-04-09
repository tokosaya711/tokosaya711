import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasAccess } from '@/lib/auth';
import { db } from '@/lib/db';
import { invalidateFeatureCache, checkFeatureAccess } from '@/lib/feature-check';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Non-admin users: load the admin's StoreSettings for shared permissions
    let settingsOwnerId = userId;
    if (role !== 'admin') {
      // Find the first active admin user's StoreSettings
      const adminUser = await db.user.findFirst({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      });
      if (adminUser) {
        settingsOwnerId = adminUser.id;
      }
      // else fall back to own settings
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
        // Handle race condition: another request may have created it already
        console.error('[settings GET] Create error:', createError);
        settings = await db.storeSettings.findFirst({
          where: { ownerId: settingsOwnerId },
        });
        if (!settings) {
          throw createError;
        }
      }
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[settings GET] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const { userId, role } = auth.user;

    // Check if user is admin OR has any settings permission from the feature matrix
    const isAdmin = hasAccess(role, ['admin']);
    const hasStorePermission = await checkFeatureAccess(role, 'settings_store', userId);
    const hasTaxPermission = await checkFeatureAccess(role, 'settings_tax', userId);
    const hasReceiptPermission = await checkFeatureAccess(role, 'settings_receipt', userId);

    if (!isAdmin && !hasStorePermission && !hasTaxPermission && !hasReceiptPermission) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { storeName, address, phone, taxRate, receiptFooter, demoPeriodDays, demoPopupMessage, autoLogoutMinutes, logoutWarningSeconds, singleDeviceLogin, features, customRoles, storeLogo } = body;

    const data: Record<string, unknown> = {};
    if (storeName !== undefined) data.storeName = storeName;
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (taxRate !== undefined) data.taxRate = Number(taxRate);
    if (receiptFooter !== undefined) data.receiptFooter = receiptFooter;
    if (demoPeriodDays !== undefined) data.demoPeriodDays = Number(demoPeriodDays);
    if (demoPopupMessage !== undefined) data.demoPopupMessage = demoPopupMessage;
    if (autoLogoutMinutes !== undefined) data.autoLogoutMinutes = Number(autoLogoutMinutes);
    if (logoutWarningSeconds !== undefined) data.logoutWarningSeconds = Number(logoutWarningSeconds);
    if (singleDeviceLogin !== undefined) data.singleDeviceLogin = Boolean(singleDeviceLogin);
    if (storeLogo !== undefined) data.storeLogo = storeLogo;
    if (features !== undefined) {
      // features can be either a string or an object — stringify if object
      data.features = typeof features === 'string' ? features : JSON.stringify(features);
    }
    if (customRoles !== undefined) {
      data.customRoles = typeof customRoles === 'string' ? customRoles : JSON.stringify(customRoles);
    }

    let settings = await db.storeSettings.findFirst({
      where: { ownerId: userId },
    });

    if (!settings) {
      settings = await db.storeSettings.create({
        data: { ...data, ownerId: userId },
      });
    } else {
      settings = await db.storeSettings.update({
        where: { id: settings.id },
        data,
      });
    }

    // Invalidate feature cache so next request picks up new permissions
    invalidateFeatureCache(userId);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[settings PUT] Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
