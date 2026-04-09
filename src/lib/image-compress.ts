/**
 * Client-side image compression utility.
 * Compresses images to max 100KB, crops to square (fit to box).
 * Uses Canvas API for broad browser/mobile compatibility.
 * Falls back to original file if compression fails (e.g., HEIC not supported).
 */

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const MAX_DIMENSION = 800;

/**
 * Load an image from a File/Blob and return an HTMLImageElement.
 * Fails for formats the browser can't decode (e.g., HEIC on most browsers).
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Browser tidak bisa membaca format gambar ini'));
    };

    img.src = url;
  });
}

/**
 * Helper: convert canvas to Blob with promise wrapper
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      type,
      quality
    );
  });
}

/**
 * Compress a single image file to max 100KB and crop to square.
 *
 * Strategy:
 * 1. If file is already under 100KB, still crop to square but keep as-is
 * 2. Center-crop to square using the smaller dimension
 * 3. Resize to max 800x800
 * 4. Try JPEG compression with decreasing quality until ≤100KB
 * 5. If Canvas fails (HEIC, unsupported format), fall back to original file
 *
 * @param file - The original image File from input/camera
 * @returns File ready for upload (compressed square or original as fallback)
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const img = await loadImage(file);

    // ── Step 1: Center-crop to square ──
    let { width, height } = img;
    const size = Math.min(width, height);
    const sx = Math.round((width - size) / 2);
    const sy = Math.round((height - size) / 2);

    // ── Step 2: Scale down if needed ──
    let canvasSize = size;
    if (canvasSize > MAX_DIMENSION) {
      canvasSize = MAX_DIMENSION;
    }

    // ── Step 3: Draw cropped square ──
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, size, size, 0, 0, canvasSize, canvasSize);

    // ── Step 4: If already under 100KB, export as-is ──
    const initialBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (initialBlob && initialBlob.size <= MAX_FILE_SIZE) {
      const timestamp = Date.now();
      const originalName = file.name.replace(/\.[^.]+$/, '') || 'image';
      const compressedName = `${originalName}-${timestamp}.jpg`;
      return new File([initialBlob], compressedName, { type: 'image/jpeg' });
    }

    // ── Step 5: Compress with decreasing quality ──
    let quality = 0.85;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= MAX_FILE_SIZE) {
        break;
      }
      quality -= 0.08;
      if (quality < 0.1) quality = 0.1;
    }

    // ── Step 6: If still over 100KB, scale down further ──
    if (!blob || blob.size > MAX_FILE_SIZE) {
      let scaleDown = 0.7;
      for (let retry = 0; retry < 4; retry++) {
        const smallerSize = Math.round(canvasSize * scaleDown);
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = smallerSize;
        smallerCanvas.height = smallerSize;
        const smallerCtx = smallerCanvas.getContext('2d');
        if (smallerCtx) {
          smallerCtx.imageSmoothingEnabled = true;
          smallerCtx.imageSmoothingQuality = 'high';
          smallerCtx.drawImage(canvas, 0, 0, smallerSize, smallerSize);

          quality = 0.75;
          for (let attempt = 0; attempt < 8; attempt++) {
            const smallerBlob = await canvasToBlob(smallerCanvas, 'image/jpeg', quality);
            if (smallerBlob && smallerBlob.size <= MAX_FILE_SIZE) {
              blob = smallerBlob;
              break;
            }
            quality -= 0.08;
            if (quality < 0.1) quality = 0.1;
          }

          if (blob && blob.size <= MAX_FILE_SIZE) break;
        }
        scaleDown -= 0.1;
        if (scaleDown < 0.3) scaleDown = 0.3;
      }
    }

    if (!blob) {
      return file;
    }

    // Generate compressed filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const compressedName = `${originalName}-${timestamp}.jpg`;

    return new File([blob], compressedName, { type: 'image/jpeg' });
  } catch {
    // Canvas/Image failed (HEIC, unsupported format, etc.) — return original file as-is
    return file;
  }
}
