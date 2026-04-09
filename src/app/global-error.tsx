'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="size-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Terjadi Kesalahan Aplikasi
            </h2>
            <p className="text-sm text-muted-foreground">
              Aplikasi mengalami error. Silakan refresh halaman untuk melanjutkan.
            </p>
            <button
              onClick={() => {
                // Clear any cached state and reload
                if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="size-4" />
              Refresh Halaman
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
