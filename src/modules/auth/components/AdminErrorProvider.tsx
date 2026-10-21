'use client';

import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useAuthErrorHandler } from '@/modules/auth/client';
import AdminAuthErrorHandler from '@/modules/auth/components/AdminAuthErrorHandler';
import logger from '@/lib/utils/logger';

interface AdminErrorContextType {
  handleGlobalError: (error: any) => boolean;
}

const AdminErrorContext = createContext<AdminErrorContextType | undefined>(undefined);

export const useAdminError = () => {
  const context = useContext(AdminErrorContext);
  if (!context) {
    throw new Error('useAdminError must be used within AdminErrorProvider');
  }
  return context;
};

interface AdminErrorProviderProps {
  children: React.ReactNode;
}

export function AdminErrorProvider({ children }: AdminErrorProviderProps) {
  const { handleError, errorState, shouldShowErrorModal } = useAuthErrorHandler({
    customMessage: 'Your admin session has expired. You will be redirected to sign in.',
    redirectToSignIn: true, // We'll handle this via the modal component
    isAdmin: true,
    showToast: false, // Let the modal handle user feedback
  });

  const handleGlobalError = useCallback((error: any) => {
    // Check if this is an auth-related error
    const isAuthError = (
      error && 
      typeof error === 'object' && 
      (
        error.name === 'AuthenticationError' ||
        (error.code && typeof error.code === 'string' && 
         (error.code.includes('AUTH') || error.code.includes('SESSION') || error.code === 'UNAUTHORIZED')) ||
        (error.statusCode && (error.statusCode === 401 || error.statusCode === 403)) ||
        (error.message && (
          error.message.toLowerCase().includes('authentication') ||
          error.message.toLowerCase().includes('unauthorized') ||
          error.message.toLowerCase().includes('session')
        ))
      )
    );

    if (isAuthError) {
      return handleError(error);
    }
    
    // For other types of errors, we can add more specific handling here
    logger.error('Unhandled admin error:', error);
    return false; // Indicates the error was not handled
  }, [handleError]);

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const isAuthError = (
        event.reason && 
        typeof event.reason === 'object' && 
        (
          event.reason.name === 'AuthenticationError' ||
          (event.reason.message && (
            event.reason.message.toLowerCase().includes('authentication') ||
            event.reason.message.toLowerCase().includes('unauthorized') ||
            event.reason.message.toLowerCase().includes('session')
          ))
        )
      );
      
      if (isAuthError) {
        event.preventDefault(); // Prevent the default browser behavior
        handleGlobalError(event.reason);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleGlobalError]);

  return (
    <AdminErrorContext.Provider value={{ handleGlobalError }}>
      {children}
      {/* Render the error modal when an auth error occurs */}
      {shouldShowErrorModal && errorState.error && (
        <AdminAuthErrorHandler 
          error={errorState.error}
          redirectUrl="/auth/admin"
        />
      )}
    </AdminErrorContext.Provider>
  );
}
