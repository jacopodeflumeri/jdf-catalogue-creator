import { Suspense } from "react";
import { requireCustomerForAccountSelection } from "@/modules/auth/server";
import { redirect } from "next/navigation";
import { getCustomerAccounts } from "@/lib/actions/account/account-actions";
import AccountSelectorClient from "./client";
import Loading from "@/components/ui/Loading";
import logger from "@/lib/utils/logger";

export default async function SelectAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const callbackUrl = resolvedSearchParams.callbackUrl || "/account";

  // Customer account selection flow
  const session = await requireCustomerForAccountSelection();
  const userId = session.user.userId || session.user.id;

  if (!userId) {
    logger.error("No user ID found in session");
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // Fetch user accounts from the database
  let userAccounts;
  try {
    userAccounts = await getCustomerAccounts(userId, true); // Allow partial auth for account selection
  } catch (error) {
    logger.error("Error loading accounts:", error);
    redirect(
      `/auth/signin?error=LoadingError&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }

  // If no accounts found, redirect to sign in with error
  if (!Array.isArray(userAccounts) || userAccounts.length === 0) {
    logger.warn("No accounts found for user:", userId);
    redirect(
      `/auth/signin?error=NoAccountsFound&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }

  // If only one account, redirect directly to the callback URL
  if (userAccounts.length === 1) {
    logger.log("Single account found, redirecting to:", callbackUrl);
    redirect(callbackUrl);
  }

  // Multiple accounts - show selection interface
  logger.log(
    "Multiple accounts found, showing selection:",
    userAccounts.length,
  );

  // Pass data to client component
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loading size="lg" text="Loading accounts..." />
        </div>
      }
    >
      <AccountSelectorClient
        accounts={userAccounts}
        callbackUrl={callbackUrl}
      />
    </Suspense>
  );
}
