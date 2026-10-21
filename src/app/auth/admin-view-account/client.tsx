'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Loading from '@/components/ui/Loading';
import { logger } from '@/lib/utils/logger';

interface AdminViewAccountClientProps {
  accountData: {
    accountId: string;
    accountName: string;
  };
  /** Already validated server-side (resolveCallbackUrl): a path under /account. */
  callbackUrl: string;
}

/**
 * Client component to update the admin's session with the account they're viewing
 * and redirect them to the Mapp Labs
 */
export default function AdminViewAccountClient({ 
  accountData, 
  callbackUrl 
}: AdminViewAccountClientProps) {
  const { data: session, status, update } = useSession();

  useEffect(() => {
    // Wait for session to load
    if (status === 'loading') {
      logger.log('Waiting for session to load...');
      return;
    }

    const updateSessionAndRedirect = async () => {
      if (!session?.user) {
        logger.error('No session found for admin view');
        window.location.href = '/auth/signin';
        return;
      }

      try {
        logger.log('Admin viewing account:', accountData.accountName, accountData.accountId);
        
        // Update session with the account being viewed
        await update({
          accountId: accountData.accountId,
          accountName: accountData.accountName,
        });

        // Small delay to ensure session update completes
        setTimeout(() => {
          logger.log('Redirecting to:', callbackUrl);
          window.location.href = callbackUrl;
        }, 300);
      } catch (error) {
        logger.error('Error updating session for admin view:', error);
        window.location.href = '/admin';
      }
    };

    updateSessionAndRedirect();
  }, [session, status, update, accountData, callbackUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loading size="lg" text={status === 'loading' ? 'Loading session...' : `Loading account: ${accountData.accountName}`} />
      </div>
    </div>
  );
}
