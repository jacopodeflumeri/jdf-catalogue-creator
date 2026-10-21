import { Metadata } from 'next'
import { getCustomerPageScope, requireFeature } from '@/modules/auth/server'
import { getCustomerTeamData, getCurrentUserNames } from '@/lib/actions/account/account-actions'
import CustomerTeamClient from './client'
import { pageTitle } from '@/lib/utils/metadata'

export const metadata: Metadata = {
  title: pageTitle('Team'),
  description: 'Manage your team members and their access permissions',
}

export default async function CustomerTeamPage() {
  // Server-side customer authentication (session resolved once per request)
  const { session } = await getCustomerPageScope();

  // Check feature access. requireFeature returns the customer profile it
  // loaded — the same per-request memo the layout used — so the page reuses it
  // rather than querying the profile again.
  const accountData = await requireFeature('teamEnabled');

  // Fetch the rest in parallel
  const [teamResult, currentUserNames] = await Promise.all([
    getCustomerTeamData(),
    getCurrentUserNames()
  ]);

  const teamData = teamResult.teamData;

  return (
    <div className="bg-gray-50 flex-1">
      <div className="py-8 px-4 sm:px-6 md:px-8 max-w-[1440px] mx-auto w-full">
        <CustomerTeamClient
          initialData={teamData}
          session={session}
          currentUserNames={currentUserNames}
          accountDomains={accountData?.domains || []}
          teamEnabled={accountData?.enabledFeatures?.teamEnabled || false}
          hasMultipleAccounts={accountData?.hasMultipleAccounts || false}
        />
      </div>
    </div>
  )
}
