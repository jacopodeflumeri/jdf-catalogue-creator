import { requireCustomer, isCompanyCustomer } from '@/modules/auth/server';
import { getCustomerProfile, isCustomerAccountDisabled } from '@/lib/actions/account/account-profile-actions';
import CustomerLayoutClient from '@/components/account/layout/CustomerLayoutClient';
import CompanyCustomerLayout from '@/components/account/layout/CompanyCustomerLayout';
import type { CustomerAccountData } from '@/types';
import logger from '@/lib/utils/logger';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side customer authentication check. Deliberately the bare session
  // (memoized per request), not getCustomerPageScope(): awaiting the page's
  // eligibility/company-context lookups here would hold back the shell AND the
  // loading skeleton (which renders inside this layout) until they finish. The
  // page awaits the scope itself; both share the same per-request memos.
  const session = await requireCustomer();

  // Company-Login (Mapp Cloud) customers have no local Account/User — skip all
  // the account-based fetches (profile, disabled check) and the legacy nav, and
  // render the minimal company-customer shell instead.
  if (isCompanyCustomer(session)) {
    return (
      <CompanyCustomerLayout session={session}>
        {children}
      </CompanyCustomerLayout>
    );
  }

  // The disabled check and the profile are independent, so they load in
  // parallel rather than one after the other (the profile is simply unused
  // when the account turns out to be disabled).
  const [accountDisabled, customerAccount] = await Promise.all([
    isCustomerAccountDisabled(),
    getCustomerProfile().catch((error: unknown): CustomerAccountData | null => {
      logger.error('Failed to fetch customer account in layout:', error);
      // Continue with null account - layout should still render
      return null;
    }),
  ]);

  if (accountDisabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Unavailable</h1>
            <p className="text-gray-600 mb-6">
              We are having issues accessing your account. Please contact your Customer Success Manager or support team for assistance.
            </p>
            <div className="space-y-3">
              <a 
                href="/auth/signout" 
                className="inline-flex items-center justify-center w-full px-6 py-3 border-2 border-gray-200 bg-white text-gray-700 font-medium rounded-xl transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Sign Out
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CustomerLayoutClient 
      customerAccount={customerAccount}
      session={session}
    >
      {children}
    </CustomerLayoutClient>
  );
}
