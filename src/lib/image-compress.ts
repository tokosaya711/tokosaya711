/**
 * Client-side image compression utility.
 * Compresses images to max 300KB while maintaining clear quality.
 * Uses Canvas API for broad browser/mobile compatibility.
 * Falls back to original file if compression fails (e.g., HEIC not supported).
 */

const MAX_FILE_SIZE = 300 * 1024; // 300KB
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;

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
 * Compress a single image file to max 300KB using Canvas API.
 *
 * Strategy:
 * 1. If file is already under 300KB, return as-is (no compression needed)
 * 2. Try Canvas-based JPEG compression
 * 3. If Canvas fails (HEIC, unsupported format), fall back to original file
 *
 * @param file - The original image File from input/camera
 * @returns File ready for upload (compressed or original as fallback)
 */
export async function compressImage(file: File): Promise<File> {
  // If already under 300KB, no compression needed at all
  if (file.size <= MAX_FILE_SIZE) {
    return file;
  }

  // Try Canvas-based compression
  try {
    const img = await loadImage(file);

    // Calculate dimensions (maintain aspect ratio, cap at MAX)
    let { width, height } = img;
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Create canvas and draw
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // Canvas not available — return original file
      return file;
    }

    // Use high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Try JPEG compression with decreasing quality
    let quality = 0.92;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);

      if (blob && blob.size <= MAX_FILE_SIZE) {
        break;
      }

      // Reduce quality step by step
      quality -= 0.1;
      if (quality < 0.1) quality = 0.1;
    }

    if (!blob) {
      // Compression produced nothing — return original
      return file;
    }

    // If still over 300KB after quality reduction, try smaller dimensions
    if (blob.size > MAX_FILE_SIZE) {
      const scaleDown = 0.75;
      const smallerCanvas = document.createElement('canvas');
      smallerCanvas.width = Math.round(width * scaleDown);
      smallerCanvas.height = Math.round(height * scaleDown);
      const smallerCtx = smallerCanvas.getContext('2d');
      if (smallerCtx) {
        smallerCtx.imageSmoothingEnabled = true;
        smallerCtx.imageSmoothingQuality = 'high';
        smallerCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);

        quality = 0.85;
        for (let attempt = 0; attempt < 5; attempt++) {
          const smallerBlob = await canvasToBlob(smallerCanvas, 'image/jpeg', quality);
          if (smallerBlob && smallerBlob.size <= MAX_FILE_SIZE) {
            blob = smallerBlob;
            break;
          }
          quality -= 0.1;
          if (quality < 0.1) quality = 0.1;
        }
      }
    }

    // If compressed result is still over 500KB, just return original
    if (blob && blob.size > 500 * 1024) {
      return file;
    }

    // Generate compressed filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const compressedName = `${originalName}-compressed-${timestamp}.jpg`;

    return new File([blob!], compressedName, { type: 'image/jpeg' });
  } catch {
    // Canvas/Image failed (HEIC, unsupported format, etc.) — return original file as-is
    return file;
  }
}
