import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { authenticateRequest } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/feature-check';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;
    const { userId, role } = auth.user;

    // Check if user has permission to upload product photos
    // Admin always has access; others need any category-specific photo permission
    if (role !== 'admin') {
      const [canPhotoCake, canPhotoFood, canPhotoSembako] = await Promise.all([
        checkFeatureAccess(role, 'cake_photo'),
        checkFeatureAccess(role, 'food_photo'),
        checkFeatureAccess(role, 'sembako_photo'),
      ]);
      if (!canPhotoCake && !canPhotoFood && !canPhotoSembako) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda tidak memiliki izin untuk mengupload foto produk.' },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    // Validate file type — allow common image types, skip check if type is empty (some mobile browsers)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml', 'image/heic', 'image/heif', 'image/avif'];
    if (file.type && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan PNG, JPG, atau WebP.' },
        { status: 400 }
      );
    }

    // Max 10MB raw — sharp will compress after
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Ukuran file terlalu besar. Maksimal 10MB.' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const uuid = randomUUID().slice(0, 8);
    const filename = `${timestamp}-${uuid}.jpg`;

    // Support uploads to different directories based on query param
    const targetDir = request.nextUrl.searchParams.get('dir') || 'products';
    const safeDir = targetDir.replace(/[^a-zA-Z0-9_-]/g, ''); // prevent path traversal
    const dir = join(process.cwd(), 'public', 'uploads', safeDir);
    mkdirSync(dir, { recursive: true });

    const filepath = join(dir, filename);

    // Process with sharp: convert any format (HEIC, PNG, WebP, etc.) to JPEG
    // This ensures browser compatibility regardless of source format
    try {
      let pipeline = sharp(buffer);

      // Detect format from buffer (more reliable than file.type)
      const metadata = await pipeline.metadata();
      const detectedFormat = metadata.format || 'jpeg';

      // Resize if very large (max 1920px on longest side) while maintaining aspect ratio
      if (metadata.width && metadata.height) {
        const maxDim = 1920;
        if (metadata.width > maxDim || metadata.height > maxDim) {
          pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
        }
      }

      // Convert to JPEG with high quality for all non-GIF formats
      // GIF should stay as GIF to preserve animation
      if (detectedFormat === 'gif') {
        const gifFilename = `${timestamp}-${uuid}.gif`;
        const gifPath = join(dir, gifFilename);
        await pipeline.toFile(gifPath);

        return NextResponse.json({
          url: `/api/files/${safeDir}/${gifFilename}`,
          filename: file.name,
          size: file.size,
        });
      } else if (detectedFormat === 'svg') {
        // SVG: save as-is (sharp can't convert SVG to raster without additional config)
        writeFileSync(filepath, buffer);
      } else {
        // Convert HEIC, PNG, WebP, AVIF, BMP, TIFF, etc. → JPEG
        // JPEG quality 85 is a good balance between quality and file size
        await pipeline
          .jpeg({ quality: 85, mozjpeg: true, progressive: true })
          .rotate() // auto-rotate based on EXIF
          .toFile(filepath);
      }
    } catch (sharpErr) {
      // If sharp fails (e.g., corrupt file, unsupported format), try saving the raw buffer
      console.warn('Sharp processing failed, saving raw file:', sharpErr);
      writeFileSync(filepath, buffer);
    }

    return NextResponse.json({
      url: `/api/files/${safeDir}/${filename}`,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Gagal mengupload gambar' }, { status: 500 });
  }
}
