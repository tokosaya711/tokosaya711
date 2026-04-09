'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="size-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                Terjadi Kesalahan
              </h3>
              <p className="text-sm text-muted-foreground">
                Halaman ini mengalami error yang tidak terduga. Silakan coba lagi atau refresh halaman.
              </p>
              {this.state.error && (
                <p className="text-xs text-red-400 mt-2 font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="size-4" />
                Coba Lagi
              </Button>
              <Button onClick={this.handleRefresh} className="gap-2">
                Refresh Halaman
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
