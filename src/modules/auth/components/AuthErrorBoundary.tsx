'use client';

import React from 'react';
import { signOut } from 'next-auth/react';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import logger from '@/lib/utils/logger';
import { isNextControlFlowError } from '@/lib/utils/next-errors';

interface AuthErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
}

export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Let Next.js control-flow signals (notFound()/redirect()) propagate.
    if (isNextControlFlowError(error)) return;
    logger.error('[AuthErrorBoundary] Caught error:', error, errorInfo);

    // Check if this is a session expired error using flexible detection
    // This works with any error that has the right name or message content
    const isSessionExpiredError = (
      error.name === 'SessionExpiredError' ||
      (error.message && error.message.toLowerCase().includes('session expired')) ||
      (error.message && error.message.toLowerCase().includes('session')) && 
      (error.message && error.message.toLowerCase().includes('expired'))
    );

    if (isSessionExpiredError) {
      this.handleSessionExpired(error);
    }
  }

  private async handleSessionExpired(error: Error) {
    // Extract role and redirect path from error properties or use sensible defaults
    // This works with both custom SessionExpiredError objects and generic Error objects
    const role = (error as any).role || 'customer';
    const redirectPath = (error as any).redirectPath || (role === 'admin' ? '/auth/admin' : '/auth/signin');
    
    logger.warn(`[AuthErrorBoundary] Session expired for ${role}, redirecting to ${redirectPath}`);
    
    try {
      // Clear NextAuth session
      await signOut({ redirect: false });
      logger.log('[AuthErrorBoundary] Session cleared');
    } catch (signOutError) {
      logger.error('[AuthErrorBoundary] Error clearing session:', signOutError);
    }

    // Redirect to the appropriate login page
    window.location.href = redirectPath;
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Re-throw Next.js control-flow signals so notFound()/redirect() render
      // as a 404/redirect instead of this boundary's fallback.
      if (isNextControlFlowError(this.state.error)) {
        throw this.state.error;
      }

      // Check if this is a session expired error
      const isSessionExpiredError = (
        this.state.error.name === 'SessionExpiredError' ||
        (this.state.error.message && this.state.error.message.toLowerCase().includes('session expired')) ||
        (this.state.error.message && this.state.error.message.toLowerCase().includes('session')) && 
        (this.state.error.message && this.state.error.message.toLowerCase().includes('expired'))
      );

      if (isSessionExpiredError) {
        // Show a brief loading message while redirecting
        return (
          <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100">
                <Icon type="lock" className="text-primary-600" size="lg" />
            </div>
            <div className="text-center">
                <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Session Expired</h2>
                <p className="mt-2 text-center text-sm text-gray-600">Redirecting to login...</p>
            </div>
          </div>
        );
      }

      // For other errors, show a generic error boundary
      return (
          <div className="flex-1 h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100">
                <Icon type="lock" className="text-primary-600" size="lg" />
            </div>
            <div className="text-center">
                <h2 className="my-6 text-center text-3xl font-bold text-gray-900">Something went wrong</h2>
                <Button
                    onClick={() => this.setState({ hasError: false })}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                Reload Page
                </Button>
            </div>
          </div>
      );
    }

    return this.props.children;
  }
}
