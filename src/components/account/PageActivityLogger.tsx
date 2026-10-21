'use client';

import logger from '@/lib/utils/logger';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { isCompanyCustomer } from '@/modules/auth/client';

interface PageActivityLoggerProps {
  pageTitle?: string;
  disabled?: boolean;
}

/**
 * PageActivityLogger Component
 * 
 * Automatically logs page visits for legacy (magic-link) customer users on
 * non-admin pages. Company-Login customers are skipped client-side.
 * This component should be included in the main layout or individual pages
 * where activity logging is desired.
 */
export function PageActivityLogger({ pageTitle, disabled = false }: PageActivityLoggerProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    // Don't log if disabled, session is loading, or user is not authenticated
    if (disabled || status === 'loading' || !session) {
      return;
    }

    // Only log for customer users, not admin users
    if (session.user.role !== 'customer') {
      return;
    }

    // Company-Login (Keycloak / Mapp Cloud) customers have no local User, so
    // the page-visit action has nothing to record for them. Return here so no
    // server-action request is sent on every navigation; legacy (magic-link)
    // customers are still logged.
    if (isCompanyCustomer(session)) {
      return;
    }

    // Don't log admin pages
    if (pathname.startsWith('/admin')) {
      return;
    }

    // Don't log auth pages
    if (pathname.startsWith('/auth')) {
      return;
    }

    // Log the page visit
    const logVisit = async () => {
      try {
        const { logPageVisit } = await import('@/lib/actions/admin/activity-actions');
        await logPageVisit(pathname);
      } catch (error) {
        // Silently fail - we don't want logging errors to affect user experience
        logger.log('Page activity logging failed:', error);
      }
    };

    // Small delay to ensure page is fully loaded
    const timer = setTimeout(logVisit, 1000);

    return () => clearTimeout(timer);
  }, [pathname, session, status, pageTitle, disabled]);

  // This component doesn't render anything
  return null;
}

/**
 * Hook for manual activity logging
 * 
 * Use this hook when you need to log specific activities beyond page visits
 */
export function useActivityLogger() {
  const { data: session } = useSession();

  const logCustomActivity = async (data: {
    type: string;
    details: string;
    message: string;
    linked_id?: number;
  }) => {
    // Only log for authenticated customers
    if (!session || session.user.role !== 'customer') {
      return { success: false, error: 'Not authorized to log activity' };
    }

    try {
      // Use API route for client-side logging
      const response = await fetch('/api/account/activity-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to log activity' };
      }
    } catch (error) {
      logger.error('Failed to log custom activity:', error);
      return { success: false, error: 'Failed to log activity' };
    }
  };

  const getActivityLogs = async () => {
    // Only fetch for authenticated customers
    if (!session || session.user.role !== 'customer') {
      return null;
    }

    try {
      const response = await fetch('/api/account/activity-logs');
      
      if (response.ok) {
        return await response.json();
      } else {
        logger.error('Failed to fetch activity logs');
        return null;
      }
    } catch (error) {
      logger.error('Failed to fetch activity logs:', error);
      return null;
    }
  };

  return {
    logCustomActivity,
    getActivityLogs,
    isCustomer: session?.user.role === 'customer',
    isAuthenticated: !!session,
  };
}
