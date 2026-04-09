import jwt from 'jsonwebtoken';
import { db } from './db';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'pos-secret-key-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  username: string;
  role: string;
  isDemo: boolean;
  demoExpiresAt?: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract JWT from request Authorization header, verify it, and confirm
 * the user still exists in the database. Returns the payload on success
 * or a NextResponse with 401 on failure.
 */
export async function authenticateRequest(
  request: Request
): Promise<{ success: true; user: JWTPayload } | { success: false; response: NextResponse }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, response: NextResponse.json({ error: 'Token tidak valid' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return { success: false, response: NextResponse.json({ error: 'Token tidak valid' }, { status: 401 }) };
  }

  // Verify user still exists in database
  const dbUser = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return { success: false, response: NextResponse.json({ error: 'Akun tidak ditemukan, silakan login ulang' }, { status: 401 }) };
  }

  return { success: true, user: payload };
}

export async function authenticateByUsername(username: string, password: string) {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return null;
  if (!user.isActive) return null;

  const bcrypt = await import('bcryptjs');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  // Check if demo account has expired
  if (user.isDemo && user.demoExpiresAt && new Date() > user.demoExpiresAt) {
    return null;
  }

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    isDemo: user.isDemo,
    ...(user.demoExpiresAt && { demoExpiresAt: user.demoExpiresAt.toISOString() }),
  };

  const token = signToken(payload);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      isDemo: user.isDemo,
      demoExpiresAt: user.demoExpiresAt ? user.demoExpiresAt.toISOString() : null,
    },
  };
}

export function hasAccess(role: string, required: string[]): boolean {
  return required.includes(role);
}
