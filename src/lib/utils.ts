import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert an image path to a URL served by the API.
 * - `/uploads/products/foo.jpg` → `/api/files/products/foo.jpg`
 * - Already `/api/files/...` → passthrough
 * - Empty/null/undefined → empty string
 */
export function toImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('/api/files/')) return path;
  if (path.startsWith('/uploads/')) return path.replace('/uploads/', '/api/files/');
  return path;
}
