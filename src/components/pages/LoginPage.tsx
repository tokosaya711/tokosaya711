'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cake, Eye, EyeOff, Loader2, Lock, Cookie, Croissant, User, AlertTriangle, Phone, Mail, AtSign, MapPin, MonitorSmartphone } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/lib/auth-store';
import { toImageUrl } from '@/lib/utils';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceConflictPopup, setDeviceConflictPopup] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [storeName, setStoreName] = useState('Sweet Bakery & Food');
  const [storeLogo, setStoreLogo] = useState('');

  // Fetch store info for branding
  useEffect(() => {
    async function loadStoreInfo() {
      try {
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          if (data.storeName) setStoreName(data.storeName);
          if (data.storeLogo) setStoreLogo(data.storeLogo);
        }
      } catch { /* use defaults */ }
    }
    loadStoreInfo();
  }, []);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for device conflict (single device login)
        if (data.deviceConflict) {
          setDeviceConflictPopup(true);
          return;
        }
        const errorMsg = data.error || 'Login gagal. Silakan coba lagi.';
        // Check for demo/trial expired error
        if (errorMsg.toLowerCase().includes('trial') || errorMsg.toLowerCase().includes('demo') || errorMsg.toLowerCase().includes('berakhir')) {
          setError('⚠️ Masa trial Anda telah berakhir. Silakan hubungi admin untuk upgrade akun.');
        } else {
          setError(errorMsg);
        }
        return;
      }

      useAuthStore.getState().login(data.token, data.user);
      // Navigate to dashboard on login
      const { useAppStore } = await import('@/lib/app-store');
      useAppStore.getState().setCurrentPage('dashboard');
    } catch {
      setError('Terjadi kesalahan koneksi. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (regPassword !== regConfirmPassword) {
      setError('Password dan konfirmasi password tidak cocok.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    if (!regUsername || regUsername.length < 3) {
      setError('Username wajib diisi minimal 3 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, phone: regPhone, username: regUsername, address: regAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registrasi gagal. Silakan coba lagi.');
        return;
      }

      // Auto-login with returned token and user
      useAuthStore.getState().login(data.token, data.user);
      // Navigate to dashboard on register
      const { useAppStore } = await import('@/lib/app-store');
      useAppStore.getState().setCurrentPage('dashboard');
    } catch {
      setError('Terjadi kesalahan koneksi. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleForm = () => {
    setShowRegister(!showRegister);
    setError('');
    setRegName('');
    setRegPhone('');
    setRegAddress('');
    setRegEmail('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-orange-50 to-rose-50">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Warm gradient blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-orange-200/25 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-rose-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-yellow-200/25 rounded-full blur-3xl" />

        {/* Floating bakery icons */}
        <motion.div
          className="absolute top-[8%] left-[10%] text-blue-300/20"
          animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Cake size={48} />
        </motion.div>

        <motion.div
          className="absolute top-[15%] right-[12%] text-orange-300/20"
          animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        >
          <Croissant size={40} />
        </motion.div>

        <motion.div
          className="absolute bottom-[20%] left-[8%] text-rose-300/20"
          animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        >
          <Cookie size={44} />
        </motion.div>

        <motion.div
          className="absolute bottom-[12%] right-[15%] text-blue-200/25"
          animate={{ y: [0, 14, 0], rotate: [0, -12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <Cake size={36} />
        </motion.div>

        <motion.div
          className="absolute top-[45%] left-[5%] text-orange-200/15"
          animate={{ y: [0, -8, 0], rotate: [0, 20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        >
          <Croissant size={32} />
        </motion.div>

        <motion.div
          className="absolute top-[55%] right-[7%] text-rose-200/15"
          animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        >
          <Cookie size={28} />
        </motion.div>

        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, #92400e 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Main login card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <Card className="border-0 shadow-2xl shadow-blue-900/10 backdrop-blur-sm bg-white/80">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            {/* Logo / Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
              className="mx-auto mb-5 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 via-orange-400 to-rose-400 flex items-center justify-center shadow-lg shadow-orange-300/40 overflow-hidden"
            >
              {storeLogo ? (
                <img
                  src={toImageUrl(storeLogo)}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Cake className="w-10 h-10 text-white" strokeWidth={1.8} />
              )}
            </motion.div>

            {/* Store name */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-2xl font-bold bg-gradient-to-r from-blue-700 via-orange-600 to-rose-600 bg-clip-text text-transparent"
            >
              {storeName}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-sm text-blue-700/60 mt-1"
            >
              Sistem Kasir • Point of Sale
            </motion.p>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-4">
            {/* Login Form */}
            {!showRegister ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Username field */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-blue-900/70 text-sm font-medium">
                    Username
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Masukkan username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-blue-900/70 text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Login button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-blue-500 via-orange-500 to-rose-500 hover:from-blue-600 hover:via-orange-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-orange-300/30 transition-all duration-300 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </span>
                  ) : (
                    'Masuk'
                  )}
                </Button>

                {/* Register link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={toggleForm}
                    className="text-sm text-blue-600/70 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                  >
                    Belum punya akun?{' '}
                    <span className="text-blue-600 hover:text-blue-700 underline underline-offset-2">
                      Daftar Akun Baru
                    </span>
                  </button>
                </div>
              </motion.form>
            ) : (
              /* Register Form */
              <motion.form
                key="register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Name field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-blue-900/70 text-sm font-medium">
                    Nama Lengkap
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Nama lengkap pemilik"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="pl-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Username field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-username" className="text-blue-900/70 text-sm font-medium">
                    Username
                  </Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="reg-username"
                      type="text"
                      placeholder="Username untuk login (min. 3 karakter)"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="pl-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      minLength={3}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Phone field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-phone" className="text-blue-900/70 text-sm font-medium">
                    No. Handphone
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="reg-phone"
                      type="tel"
                      placeholder="08xxxxxxxxxx"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="pl-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Address field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-address" className="text-blue-900/70 text-sm font-medium">
                    Alamat
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-blue-400" />
                    <textarea
                      id="reg-address"
                      placeholder="Alamat lengkap (opsional)"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="pl-10 w-full min-h-[44px] h-11 border border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50 rounded-md text-sm px-3 py-2.5 resize-none"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-blue-900/70 text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="nama@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="pl-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-blue-900/70 text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="Minimal 6 karakter"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      minLength={6}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password field */}
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm-password" className="text-blue-900/70 text-sm font-medium">
                    Konfirmasi Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                    <Input
                      id="reg-confirm-password"
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      placeholder="Ulangi password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-blue-200/60 bg-blue-50/30 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-blue-300/50"
                      required
                      minLength={6}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showRegConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Register button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-blue-500 via-orange-500 to-rose-500 hover:from-blue-600 hover:via-orange-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-orange-300/30 transition-all duration-300 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </span>
                  ) : (
                    'Daftar Akun Baru'
                  )}
                </Button>

                {/* Back to login link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={toggleForm}
                    className="text-sm text-blue-600/70 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                  >
                    Sudah punya akun?{' '}
                    <span className="text-blue-600 hover:text-blue-700 underline underline-offset-2">
                      Masuk
                    </span>
                  </button>
                </div>
              </motion.form>
            )}

          </CardContent>
        </Card>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center text-xs text-black font-semibold mt-6"
        >
(c) copyright by darrenpos 2025 All Right Service
        </motion.p>
      </motion.div>

      {/* Device Conflict Popup */}
      <AlertDialog open={deviceConflictPopup} onOpenChange={setDeviceConflictPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-rose-100">
              <MonitorSmartphone className="size-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-center">Akun Sudah Digunakan</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm">
              Akun sudah digunakan. Silahkan logout di perangkat yang lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => setDeviceConflictPopup(false)}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              Mengerti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
