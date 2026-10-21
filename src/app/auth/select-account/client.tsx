'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { switchToAccount } from '@/lib/actions/account/account-actions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/providers/ToastProvider';
import logger from '@/lib/utils/logger';

interface AccountSelectorClientProps {
  accounts: Record<string, unknown>[];
  callbackUrl: string;
}

export default function AccountSelectorClient({
  accounts,
  callbackUrl,
}: AccountSelectorClientProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const router = useRouter();
  const { addToast } = useToast();
  const { update } = useSession();

  const handleAccountSelect = async (accountId: number) => {
    setSelectedAccountId(accountId);

    startTransition(async () => {
      try {
        logger.log('Switching to account:', accountId);
        
        // Call the server action to validate and switch accounts
        const result = await switchToAccount(accountId, callbackUrl);
        
        if (result.success && result.accountData) {
          // Update the NextAuth session with the new account
          await update({
            accountId: result.accountData.accountId,
            accountName: result.accountData.accountName,
            access: result.accountData.access
          });
          
          addToast({
            type: 'success',
            message: `Switched to ${result.accountData.accountName}`
          });
          
          // Wait for session to propagate, then redirect and refresh
          setTimeout(() => {
            router.push(result.redirectUrl || callbackUrl);
            router.refresh(); // Force refresh of server components
          }, 500);
          
        } else {
          addToast({
            type: 'error',
            message: result.error || 'Failed to switch accounts'
          });
          setSelectedAccountId(null);
        }
        
      } catch (error) {
        logger.error('Account selection failed:', error);
        addToast({
          type: 'error',
          message: 'An unexpected error occurred'
        });
        setSelectedAccountId(null);
      }
    });
  };

  const formatAccountName = (accountUser: Record<string, unknown>) => {
    // Handle Prisma AccountUser structure with included account
    const account = accountUser.account as any;
    if (account?.name) {
      return account.name as string;
    }
    if (account?.companyName) {
      return account.companyName as string;
    }
    return `Account ${account?.id || accountUser.accountId}`;
  };

  const formatAccountDetails = (accountUser: Record<string, unknown>) => {
    // Show user's name or access level
    const firstName = accountUser.firstName as string;
    const lastName = accountUser.lastName as string;
    
    if (firstName) {
      return lastName ? `${firstName} ${lastName}` : firstName;
    }
    
    const access = accountUser.access as string;
    return access ? `${access.charAt(0).toUpperCase()}${access.slice(1)} Access` : "User Access";
  };

  return (
    <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100">
            <Icon type="users" size="lg" className="text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Select Account
            </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You have access to multiple accounts<br /> Please select which you would like to access
          </p>
        </div>

        <div className="space-y-4">
          {accounts.map((accountUser) => {
            const accountId = accountUser.accountId as number;
            return (
            <Card key={accountId} className="p-0 overflow-hidden" noPaddingContent>
              <button
                onClick={() => handleAccountSelect(accountId)}
                disabled={isPending}
                className={`w-full p-6 text-left transition-all duration-200 ${
                  selectedAccountId === accountId
                    ? 'bg-primary-50 border-primary-200'
                    : 'hover:bg-gray-50 focus:bg-gray-50'
                } ${
                  isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {formatAccountName(accountUser)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {formatAccountDetails(accountUser)}
                    </p>
                    {!!accountUser.createdAt && typeof accountUser.createdAt === 'string' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(accountUser.createdAt).toLocaleDateString() as string}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center ml-4">
                    {selectedAccountId === accountId && isPending ? (
                      <Loading text="" size="sm" />
                    ) : (
                      <Icon type="chevron-right" className="text-gray-400" />
                    )}
                  </div>
                </div>
              </button>
            </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            onClick={() => router.push('/auth/signout')}
            disabled={isPending}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
