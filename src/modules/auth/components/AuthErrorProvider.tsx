'use client';

import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useAuthErrorHandler } from '@/modules/auth/client';
import AuthErrorCard from '@/modules/auth/components/AuthErrorCard';
import logger from '@/lib/utils/logger';

interface AuthErrorContextType {
  handleGlobalError: (error: any) => boolean;
}

const AuthErrorContext = createContext<AuthErrorContextType | undefined>(undefined);

export const useAuthError = () => {
  const context = useContext(AuthErrorContext);
  if (!context) {
    throw new Error('useAuthError must be used within AuthErrorProvider');
  }
  return context;
};

interface AuthErrorProviderProps {
  children: React.ReactNode;
}

export function AuthErrorProvider({ children }: AuthErrorProviderProps) {
  const { handleError, errorState, clearError, shouldShowErrorModal } = useAuthErrorHandler({
    customMessage: 'Your session has expired. Please sign in again.',
    redirectToSignIn: true, // We'll handle this via the modal component
    isAdmin: false,
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
    logger.error('Unhandled customer error:', error);
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

  // Handle backdrop click to close modal
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      clearError();
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearError();
      }
    };

    if (shouldShowErrorModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [shouldShowErrorModal, clearError]);

  return (
    <AuthErrorContext.Provider value={{ handleGlobalError }}>
      {children}
      {/* Render the error modal when an auth error occurs */}
      {shouldShowErrorModal && errorState.error && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <AuthErrorCard
              type="session-expired"
              message={errorState.error.message}
              variant="warning"
              actions={['signin']}
              autoRedirect={true}
              autoRedirectDelay={3000}
              isModal={true}
            />
          </div>
        </div>
      )}
    </AuthErrorContext.Provider>
  );
}
