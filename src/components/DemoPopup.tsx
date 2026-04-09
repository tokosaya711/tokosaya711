'use client';

import { useState, useEffect, useRef } from 'react';
import { Megaphone, Calendar, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';

interface DemoPopupProps {
  onClose: () => void;
}

export default function DemoPopup({ onClose }: DemoPopupProps) {
  const { user, token } = useAuthStore();
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) return;
    if (!user?.isDemo) return;
    hasShownRef.current = true;

    // Fetch demo popup message from settings
    async function fetchSettings() {
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/settings', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.demoPopupMessage) {
            setMessage(data.demoPopupMessage);
          }
        }
      } catch {
        // Silently fail - will use default message
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [user?.isDemo, token]);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  // Don't render if not a demo user
  if (!user?.isDemo) return null;

  const formatExpiryDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const defaultMessage = 'Selamat datang! Anda menggunakan akun demo dengan akses fitur terbatas. Upgrade ke akun penuh untuk mendapatkan semua fitur.';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <Megaphone className="w-7 h-7 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-lg">
            Akun Demo
          </DialogTitle>
          <DialogDescription className="text-center">
            Informasi penting mengenai akun demo Anda
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Demo message */}
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                {message || defaultMessage}
              </div>

              {/* Expiry date */}
              {user.demoExpiresAt && (
                <div className="flex items-center gap-3 rounded-lg border border-blue-200/60 bg-blue-50/50 px-4 py-3">
                  <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600/70">Masa trial berakhir</p>
                    <p className="text-sm font-semibold text-blue-800">
                      {formatExpiryDate(user.demoExpiresAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button
                onClick={handleClose}
                className="w-full h-11 bg-gradient-to-r from-blue-500 via-orange-500 to-rose-500 hover:from-blue-600 hover:via-orange-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-orange-300/20 transition-all duration-300 cursor-pointer"
              >
                Mengerti
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
