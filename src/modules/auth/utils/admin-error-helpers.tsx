import logger from '@/lib/utils/logger';
import { AppError } from '@/types';
import AdminAuthErrorHandler from '@/modules/auth/components/AdminAuthErrorHandler';

/**
 * Utility function to handle authentication errors in admin server components
 * Returns an error handler component or null if no auth error
 */
export function handleAdminAuthError(error: unknown, redirectUrl?: string): React.ReactNode | null {
  // Check if this is an auth-related error
  const isAuthError = (
    error && 
    typeof error === 'object' && 
    (
      ('name' in error && error.name === 'AuthenticationError') ||
      ('code' in error && typeof error.code === 'string' && 
       (error.code.includes('AUTH') || error.code.includes('SESSION') || error.code === 'UNAUTHORIZED')) ||
      ('statusCode' in error && (error.statusCode === 401 || error.statusCode === 403))
    )
  );

  if (isAuthError) {
    logger.log('[Admin Auth Helper] Authentication error detected, showing error handler');
    
    // Convert to AppError format
    const appError: AppError = {
      code: (error as any).code || 'AUTH_ERROR',
      message: (error as any).message || 'Authentication failed',
      statusCode: (error as any).statusCode || 401,
      details: (error as any).details
    };
    
    logger.log('[Admin Auth Helper] Error details:', appError.message);
    return (
      <AdminAuthErrorHandler 
        error={appError}
        redirectUrl={redirectUrl}
      />
    );
  }
  
  logger.log('[Admin Auth Helper] Not an authentication error:', error);
  return null;
}

/**
 * Wrapper function to handle server actions that might throw authentication errors
 * Use this in admin page components for consistent error handling
 */
export async function withAdminAuthHandling<T>(
  action: () => Promise<T>,
  redirectUrl?: string
): Promise<{ data?: T; errorComponent?: React.ReactNode }> {
  try {
    logger.log('[Admin Auth Wrapper] Executing action...');
    const data = await action();
    logger.log('[Admin Auth Wrapper] Action completed successfully');
    return { data };
  } catch (error) {
    logger.log('[Admin Auth Wrapper] Action threw error:', error);
    const errorComponent = handleAdminAuthError(error, redirectUrl);
    if (errorComponent) {
      logger.log('[Admin Auth Wrapper] Returning error component');
      return { errorComponent };
    }
    
    logger.log('[Admin Auth Wrapper] Re-throwing non-auth error');
    // Re-throw non-auth errors
    throw error;
  }
}
