import { Metadata } from 'next'
import { requireEligibleCustomerPageScope } from '@/modules/auth/server'
import {
  getCustomerTeamData,
} from '@/lib/actions/account/account-actions'
import CustomerDashboardClient from './client'
import CompanyCustomerHome from './CompanyCustomerHome'
import { customerTopNav, customerTopNavFixed } from '@/modules/navigation/config/navigation-items'
import { pageTitle } from '@/lib/utils/metadata'

export const metadata: Metadata = {
  title: pageTitle('Dashboard'),
  description: 'Your account overview and quick access to key features',
}

export default async function CustomerDashboardPage() {
  // Server-side customer authentication + the app's eligibility policy (an
  // ineligible customer is sent to onboarding) + company context, resolved
  // once per request with the eligibility check and context lookup in parallel.
  const { session, isCompanyCustomer, context } = await requireEligibleCustomerPageScope();

  // Company-Login (Mapp Cloud) customers don't use the legacy account dashboard
  // (no Account/User); render the safe company landing. This is the template
  // baseline — apps build their real company-customer experience here.
  if (isCompanyCustomer && context) {
    return <CompanyCustomerHome session={session} context={context} />;
  }

  // Fetch all data concurrently with Promise.all()
  const [
    { teamData, mappTeamData },
  ] = await Promise.all([
    getCustomerTeamData(true),
  ]);

  const pageHeight = customerTopNav && customerTopNavFixed ? "calc(100vh - 72px)" : "100vh";

  return (
    <div className="bg-gray-50 flex-1">
      <div className="p-0 w-full" style={{ minHeight: pageHeight }}>
        <CustomerDashboardClient
          user={session.user}
          team={teamData}
          mappTeam={mappTeamData}
          session={session}
        />
      </div>
    </div>
  )
}
