'use server';

import logger from '@/lib/utils/logger';
import { requireCustomer } from '@/modules/auth/server/require-auth';
import { isPreviewSession, CUSTOMER_PREVIEW_READ_ONLY_MESSAGE } from '@/modules/customer_preview';
import { prismaService } from '@/lib/prisma/services';
import type { ActivityLogResponse } from '@/types';

/**
 * Server Actions for Activity Logging
 * All actions include authentication and authorization checks
 */


/**
 * Log activity for the current user
 */
export async function accountActivity(data: {
  type: string;
  details: string;
  message: string;
  linked_id?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireCustomer();
    // A customer write: never record an admin's "View as customer" preview as
    // the customer's activity.
    if (isPreviewSession(session)) {
      return { success: false, error: CUSTOMER_PREVIEW_READ_ONLY_MESSAGE };
    }

    // Use userId from session - it should be available now
    const userId = session.user.userId ? parseInt(session.user.userId, 10) : parseInt(session.user.id, 10);
    
    // Validate accountId exists and is valid
    if (!session.user.accountId) {
      logger.error('User session missing accountId:', session.user);
      return { success: false, error: 'User session missing account information' };
    }

    const accountId = parseInt(session.user.accountId!, 10);
    if (isNaN(accountId) || accountId <= 0) {
      logger.error('Invalid accountId in session:', session.user.accountId);
      return { success: false, error: 'Invalid account information in session' };
    }
    
    const activityLogData = {
      userId: userId,
      accountId: accountId,
      type: data.type,
      details: data.details,
      message: data.message,
      linkedId: data.linked_id,
    };

    const result = await prismaService.accountActivity.createActivity(activityLogData);
    
    if (result) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to create activity log' };
    }
  } catch (error) {
    logger.error('Failed to log activity:', error);
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('Account with ID') && error.message.includes('does not exist')) {
        return { success: false, error: 'Account not found in database' };
      }
      if (error.message.includes('User with ID') && error.message.includes('does not exist')) {
        return { success: false, error: 'User not found in database' };
      }
    }
    
    return { success: false, error: 'Failed to log activity' };
  }
}

/**
 * Get activity logs for the current user's account
 */
export async function getAccountActivityLogs(): Promise<ActivityLogResponse[] | null> {
  try {
    const session = await requireCustomer();
    
    const logs = await prismaService.accountActivity.getActivityLogsByAccountId(
      parseInt(session.user.accountId!, 10)
    );
    
    // Transform Prisma AccountActivity to ActivityLogResponse format
    const transformed: ActivityLogResponse[] = logs?.map(activity => ({
      id: activity.id,
      created_at: activity.createdAt.toISOString(),
      user_id: activity.userId,
      account_id: activity.accountId,
      type: activity.type,
      details: activity.details || '',
      message: activity.message || '',
      linked_id: activity.linkedId || undefined
    })) || [];
    
    return transformed;
  } catch (error) {
    logger.error('Failed to get activity logs:', error);
    return null;
  }
}

/**
 * Automatic page visit logging - called from page components
 */
export async function logPageVisit(pagePath: string): Promise<void> {
  try {
    const session = await requireCustomer();

    // An admin's "View as customer" preview is not the customer's visit.
    if (isPreviewSession(session)) return;

    // Additional validation - ensure we have valid account info before logging
    if (!session.user.accountId || isNaN(parseInt(session.user.accountId, 10))) {
      logger.log('Page visit logging skipped - invalid account info in session');
      return;
    }

    const linkedId = 0;
    const result = await accountActivity({
      type: 'view',
      details: pagePath,
      message: "",
      linked_id: linkedId,
    });
    
    // Log if activity logging fails, but don't throw
    if (!result.success) {
      logger.log('Page visit activity logging failed:', result.error);
    }
  } catch (error) {
    // Silently fail for page visit logging to not disrupt user experience
    logger.log('Page visit logging failed (this is non-critical):', error);
  }
}
