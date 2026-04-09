import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Prevent path traversal
    const sanitizedPath = pathSegments
      .filter((seg) => seg && !seg.includes('..') && !seg.includes('/') && !seg.includes('\\'))
      .join('/');

    if (!sanitizedPath) {
      return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 });
    }

    // Resolve file path within public/uploads/
    const filePath = join(process.cwd(), 'public', 'uploads', sanitizedPath);

    // Security check: ensure the resolved path is still within public/uploads/
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    const resolved = resolve(filePath);
    const resolvedUploads = resolve(uploadsDir);
    if (!resolved.startsWith(resolvedUploads + '/') && resolved !== resolvedUploads) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    const fileBuffer = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': `public, max-age=${MAX_AGE}, immutable`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: 'Gagal memuat file' }, { status: 500 });
  }
}
