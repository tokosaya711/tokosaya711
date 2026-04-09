'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-red-100 p-4">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Terjadi Kesalahan
        </h2>
        <p className="text-sm text-muted-foreground">
          Halaman ini mengalami error yang tidak terduga. Silakan coba refresh halaman atau kembali ke dashboard.
        </p>
        {error.message && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 max-w-full break-all">
            {error.message}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="size-4" />
            Coba Lagi
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Ke Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
