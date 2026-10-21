import { getAdminSession } from '@/modules/auth/server/require-auth';
import { adminViewAsAccount } from '@/lib/actions/account/account-actions';
import { resolveCallbackUrl } from '@/modules/auth/lib/callback-url';
import AdminViewAccountClient from './client';

/**
 * Admin View Account Page (legacy)
 * Allows admins to view a customer account as if they were that customer
 *
 * This is the older, account-only admin view, kept for apps that use the
 * magic-link customer path: it writes an accountId onto the admin's own JWT.
 * For Company-Login apps the customer_preview capability is its successor - it
 * reproduces the company-customer session read-only, expires and is audited.
 * See docs/template/capabilities/CUSTOMER_PREVIEW.md.
 *
 * Query params:
 * - accountId: The account ID to view
 * - callbackUrl: Optional path to redirect to after viewing. Only a same-site
 *   path under /account is honoured (anything else, e.g. an off-site or
 *   `javascript:` URL, falls back to /account): it is user-controlled and the
 *   client navigates to it.
 */
export default async function AdminViewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; callbackUrl?: string }>;
}) {
  // Get admin session - this will redirect if not admin
  await getAdminSession();
  
  // searchParams is a Promise in the App Router
  const resolvedSearchParams = await searchParams;
  const accountId = resolvedSearchParams.accountId;
  const callbackUrl = resolveCallbackUrl(resolvedSearchParams.callbackUrl, 'account');

  // Validate accountId parameter
  if (!accountId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Request</h1>
          <p className="mt-2 text-gray-600">No account ID provided</p>
          <a href="/admin" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
            Return to Admin Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Get account data for viewing
  const result = await adminViewAsAccount(parseInt(accountId, 10));

  if (!result.success || !result.accountData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Account Not Found</h1>
          <p className="mt-2 text-gray-600">{result.error || `Unable to load account ${accountId}`}</p>
          <a href="/admin" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
            Return to Admin Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Render client component to update session and redirect
  return (
    <AdminViewAccountClient 
      accountData={result.accountData}
      callbackUrl={callbackUrl}
    />
  );
}
