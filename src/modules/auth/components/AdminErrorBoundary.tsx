'use client';

import React from 'react';
import { AppError } from '@/types';
import AdminAuthErrorHandler from '@/modules/auth/components/AdminAuthErrorHandler';
import AuthErrorCard from '@/modules/auth/components/AuthErrorCard';
import logger from '@/lib/utils/logger';
import { isNextControlFlowError } from '@/lib/utils/next-errors';

interface AdminErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  constructor(props: AdminErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Let Next.js control-flow signals (notFound()/redirect()) propagate.
    if (isNextControlFlowError(error)) return;
    logger.error('Admin Error Boundary caught an error:', error, errorInfo);
    
    // Check if it's an authentication-related error
    const isAuthError = (
      error.name === 'AuthenticationError' ||
      error.message.toLowerCase().includes('authentication') ||
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('session')
    );
    
    if (isAuthError) {
      logger.log('AdminErrorBoundary: Authentication error detected, will use AdminAuthErrorHandler');
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Re-throw Next.js control-flow signals so notFound()/redirect() render
      // as a 404/redirect instead of this boundary's fallback.
      if (isNextControlFlowError(this.state.error)) {
        throw this.state.error;
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Check if it's an authentication-related error
      const isAuthError = (
        this.state.error.name === 'AuthenticationError' ||
        this.state.error.message.toLowerCase().includes('authentication') ||
        this.state.error.message.toLowerCase().includes('unauthorized') ||
        this.state.error.message.toLowerCase().includes('session')
      );

      // If it's an authentication error, use the specific handler
      if (isAuthError) {
        const appError: AppError = {
          code: 'AUTH_ERROR',
          message: this.state.error.message,
          statusCode: 401,
          details: this.state.error
        };
        return <AdminAuthErrorHandler error={appError} />;
      }

      // For other errors, use the generic fallback
      return <AdminErrorFallback error={this.state.error} onReset={() => this.setState({ hasError: false })} />;
    }

    return this.props.children;
  }
}

interface AdminErrorFallbackProps {
  error?: Error;
  onReset: () => void;
}

function AdminErrorFallback({ error, onReset }: AdminErrorFallbackProps) {
  const handleRetry = () => {
    onReset();
    // Optionally reload the page
    window.location.reload();
  };

  return (
    <AuthErrorCard
      type="generic-error"
      message={error?.message || "An unexpected error occurred."}
      variant="error"
      actions={['signin', 'retry']}
      onRetry={handleRetry}
    />
  );
}

export default AdminErrorBoundary;
