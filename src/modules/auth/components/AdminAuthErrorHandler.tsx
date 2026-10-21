'use client';

import logger from '@/lib/utils/logger';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { AppError } from '@/types';
import AuthErrorCard from '@/modules/auth/components/AuthErrorCard';

interface AdminAuthErrorHandlerProps {
  error: AppError;
  redirectUrl?: string;
}

/**
 * Component to handle authentication errors that occur during server-side rendering
 * Shows a toast notification and provides options for the user as a modal overlay
 */
export default function AdminAuthErrorHandler({ error }: AdminAuthErrorHandlerProps) {
  const router = useRouter();
  const { addToast } = useToast();

  logger.log('[AdminAuthErrorHandler] Component mounted with error:', error.message);

  useEffect(() => {
    logger.log('[AdminAuthErrorHandler] useEffect triggered, showing toast...');
    // Show toast notification when component mounts
    addToast({
      type: 'error',
      message: error.message,
      duration: 5000
    });

    logger.log('[AdminAuthErrorHandler] Setting up auto-redirect timer...');
    // Auto-redirect after a delay
    const timer = setTimeout(() => {
      logger.log('[AdminAuthErrorHandler] Auto-redirecting to admin sign-in...');
      router.push('/auth/admin');
    }, 3000);

    return () => {
      logger.log('[AdminAuthErrorHandler] Cleaning up timer...');
      clearTimeout(timer);
    };
  }, [error.message, router, addToast]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        logger.log('[AdminAuthErrorHandler] Escape key pressed, redirecting...');
        router.push('/auth/admin');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [router]);

  // Handle backdrop click to close modal
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      logger.log('[AdminAuthErrorHandler] Backdrop clicked, redirecting...');
      router.push('/auth/admin');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <AuthErrorCard
          type="session-expired"
          message={error.message}
          variant="warning"
          actions={['dashboard', 'signin']}
          autoRedirect={true}
          autoRedirectDelay={3000}
          isModal={true}
        />
      </div>
    </div>
  );
}
