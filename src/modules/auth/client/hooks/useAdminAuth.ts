/**
 * Client-Side Admin Authentication Hook
 * 
 * Custom React hook for protecting admin routes on the client side.
 * Works with NextAuth session to validate admin access and enforce
 * super admin requirements.
 * 
 * Features:
 * - Automatic redirect on auth failure
 * - Super admin enforcement option
 * - Loading state handling
 * - Content flash prevention
 * - Custom redirect paths
 * 
 * @example Basic admin protection
 * ```typescript
 * 'use client';
 * import { useAdminAuth } from '@/modules/auth';
 * 
 * export default function AdminPanel() {
 *   const { session, status, isAuthorized } = useAdminAuth();
 *   
 *   if (!isAuthorized) return null; // Prevent content flash
 *   
 *   return <div>Admin Content</div>;
 * }
 * ```
 * 
 * @example Super admin protection
 * ```typescript
 * const { session, isAuthorized } = useAdminAuth({ 
 *   requireSuperAdmin: true 
 * });
 * 
 * if (!isAuthorized) return <Loading />;
 * ```
 * 
 * @example Custom redirects
 * ```typescript
 * useAdminAuth({ 
 *   redirectTo: '/login',
 *   requireSuperAdmin: true,
 *   superAdminRedirectTo: '/admin/home'
 * });
 * ```
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { isSessionSuperAdmin } from '../../utils/auth-helpers';
import type { UseAdminAuthOptions, UseAdminAuthReturn } from '../../types';

/**
 * Admin Authentication Hook
 * 
 * Protects client components by checking admin authentication status.
 * Automatically redirects if authentication fails. Provides loading states
 * and authorization flags to prevent content flash.
 * 
 * The hook uses NextAuth's useSession() internally and adds admin-specific
 * validation logic, including super admin checks and IP restrictions.
 * 
 * @param options - Configuration for admin authentication requirements
 * @returns Session data, loading status, and authorization flag
 * 
 * @example Basic usage
 * ```typescript
 * function AdminDashboard() {
 *   const { session, status, isAuthorized } = useAdminAuth();
 *   
 *   if (status === 'loading') return <Loading />;
 *   if (!isAuthorized) return null;
 *   
 *   return <Dashboard admin={session.user} />;
 * }
 * ```
 * 
 * @example Super admin only
 * ```typescript
 * function SuperAdminSettings() {
 *   const { session, isAuthorized } = useAdminAuth({ 
 *     requireSuperAdmin: true,
 *     superAdminRedirectTo: '/admin'
 *   });
 *   
 *   if (!isAuthorized) return <AccessDenied />;
 *   
 *   return <Settings />;
 * }
 * ```
 * 
 * @example With loading state
 * ```typescript
 * function AdminPanel() {
 *   const { session, status, isAuthorized } = useAdminAuth();
 *   
 *   if (status === 'loading') {
 *     return <Skeleton />;
 *   }
 *   
 *   if (!isAuthorized) {
 *     return <Redirect />;
 *   }
 *   
 *   return <Panel admin={session.user.email} />;
 * }
 * ```
 */
export function useAdminAuth(options: UseAdminAuthOptions = {}): UseAdminAuthReturn {
  const {
    redirectTo = '/auth/signin',
    requireSuperAdmin = false,
    superAdminRedirectTo = '/admin'
  } = options;

  const { data: session, status } = useSession();
  const router = useRouter();

  /**
   * Calculate authorization status based on session and requirements
   * Memoized to prevent unnecessary recalculations
   */
  const isAuthorized = useMemo(() => {
    // Still loading session - not authorized yet
    if (status === 'loading') return false;
    
    // No session or not an admin - not authorized
    if (!session || session.user.role !== 'admin') return false;
    
    // Super admin required but user isn't super admin - not authorized
    if (requireSuperAdmin && !isSessionSuperAdmin(session)) return false;
    
    // All checks passed - authorized
    return true;
  }, [session, status, requireSuperAdmin]);

  /**
   * Handle authentication redirects
   * Only runs when session state changes or requirements change
   */
  useEffect(() => {
    // Don't redirect while session is loading
    if (status === 'loading') return;

    // Check if user is authenticated and is an admin
    if (!session || session.user.role !== 'admin') {
      router.push(redirectTo);
      return;
    }

    // If super admin is required, check for super admin privileges
    if (requireSuperAdmin && !isSessionSuperAdmin(session)) {
      router.push(superAdminRedirectTo);
      return;
    }
  }, [session, status, router, redirectTo, requireSuperAdmin, superAdminRedirectTo]);

  return { 
    session, 
    status, 
    isAuthorized 
  };
}
