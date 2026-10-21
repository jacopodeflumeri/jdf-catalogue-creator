/**
 * Client-Side Authentication Error Handler Hook
 * 
 * Custom React hook for handling authentication-related errors consistently
 * across the application. Detects auth errors, shows user feedback via toasts,
 * and provides modal-based error states.
 * 
 * Features:
 * - Automatic auth error detection
 * - Toast notifications for immediate feedback
 * - Modal-based error states for better UX
 * - Custom error messages
 * - Flexible error handling options
 * 
 * @example Basic usage
 * ```typescript
 * 'use client';
 * import { useAuthErrorHandler } from '@/modules/auth';
 * 
 * export default function MyComponent() {
 *   const { handleError, errorState, clearError } = useAuthErrorHandler();
 *   
 *   async function handleAction() {
 *     try {
 *       await someAuthenticatedAction();
 *     } catch (error) {
 *       if (handleError(error)) {
 *         return; // Auth error was handled
 *       }
 *       // Handle other errors
 *     }
 *   }
 * }
 * ```
 * 
 * @example With custom message
 * ```typescript
 * const { handleError } = useAuthErrorHandler({
 *   customMessage: 'Your session has expired. Please sign in again.',
 *   showToast: true,
 *   redirectToSignIn: true
 * });
 * ```
 * 
 * @example Modal-based error display
 * ```typescript
 * const { errorState, shouldShowErrorModal, clearError } = useAuthErrorHandler();
 * 
 * return (
 *   <>
 *     {shouldShowErrorModal && (
 *       <ErrorModal 
 *         error={errorState.error} 
 *         onClose={clearError}
 *       />
 *     )}
 *   </>
 * );
 * ```
 */

'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import type { UseAuthErrorOptions, AuthError, AuthErrorState } from '../../types';

/**
 * Authentication Error Handler Hook
 * 
 * Provides consistent error handling for authentication-related errors.
 * Automatically detects auth errors from various error formats and provides
 * appropriate user feedback via toasts and modal states.
 * 
 * The hook can handle:
 * - AppError objects with auth-related codes
 * - HTTP errors with 401/403 status codes
 * - AuthenticationError objects
 * - Any error with 'AUTH' or 'SESSION' in the code
 * 
 * @param options - Configuration for error handling behavior
 * @returns Error handling functions and state
 * 
 * @example Server action with error handling
 * ```typescript
 * function MyComponent() {
 *   const { handleError } = useAuthErrorHandler();
 *   
 *   async function updateProfile() {
 *     try {
 *       await updateProfileAction(data);
 *     } catch (error) {
 *       const wasAuthError = handleError(error);
 *       if (!wasAuthError) {
 *         // Handle non-auth errors
 *         setError(error);
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * @example API call with error handling
 * ```typescript
 * function DataFetcher() {
 *   const { handleError, shouldShowErrorModal, clearError } = useAuthErrorHandler({
 *     redirectToSignIn: true,
 *     showToast: true
 *   });
 *   
 *   async function fetchData() {
 *     try {
 *       const response = await fetch('/api/data');
 *       if (!response.ok) {
 *         throw new Error('Failed to fetch');
 *       }
 *     } catch (error) {
 *       handleError(error);
 *     }
 *   }
 *   
 *   return (
 *     <>
 *       <button onClick={fetchData}>Load Data</button>
 *       {shouldShowErrorModal && (
 *         <AuthErrorModal onClose={clearError} />
 *       )}
 *     </>
 *   );
 * }
 * ```
 * 
 * @example Custom error message for admins
 * ```typescript
 * const { handleError } = useAuthErrorHandler({
 *   isAdmin: true,
 *   customMessage: 'Admin session expired. Please authenticate again.',
 *   redirectToSignIn: true
 * });
 * ```
 */
export function useAuthErrorHandler(options: UseAuthErrorOptions = {}) {
  const { addToast } = useToast();
  const [errorState, setErrorState] = useState<AuthErrorState>({ 
    error: null, 
    isVisible: false 
  });
  
  const {
    redirectToSignIn = true,
    showToast = true,
    customMessage,
  } = options;

  /**
   * Handle potential authentication errors
   * 
   * Checks if the error is authentication-related and handles it appropriately.
   * Returns true if the error was handled, false otherwise.
   * 
   * @param error - Any error object to check and handle
   * @returns true if error was an auth error and was handled, false otherwise
   */
  const handleError = useCallback((error: any): boolean => {
    // Check if this is an auth-related error
    const isAuthError = (
      // AppError with auth-related code
      (error && typeof error === 'object' && error.code && 
       (error.code.includes('AUTH') || 
        error.code.includes('SESSION') || 
        error.code === 'UNAUTHORIZED')) ||
      // HTTP error with auth status code
      (error && error.statusCode && 
       (error.statusCode === 401 || error.statusCode === 403)) ||
      // Named authentication error
      (error && error.name === 'AuthenticationError')
    );

    if (isAuthError) {
      // Convert to AppError format if needed
      const appError: AuthError = {
        code: error.code || 'AUTH_ERROR',
        message: customMessage || error.message || 'Authentication failed',
        statusCode: error.statusCode || 401,
        details: error.details
      };
      
      // Show toast notification if enabled
      if (showToast) {
        addToast({
          type: 'error',
          message: appError.message,
          duration: 5000
        });
      }
      
      // Set modal state if redirect is enabled
      if (redirectToSignIn) {
        setErrorState({ error: appError, isVisible: true });
        return true;
      }
      
      return true; // Indicates the error was handled
    }
    
    return false; // Indicates this wasn't an auth error
  }, [addToast, customMessage, showToast, redirectToSignIn]);

  /**
   * Clear the error state and hide modal
   */
  const clearError = useCallback(() => {
    setErrorState({ error: null, isVisible: false });
  }, []);

  return { 
    /** Function to handle and check for auth errors */
    handleError, 
    /** Current error state (error object and visibility flag) */
    errorState, 
    /** Function to clear error state */
    clearError,
    /** Helper flag to determine if error modal should be shown */
    shouldShowErrorModal: errorState.isVisible && errorState.error !== null
  };
}
