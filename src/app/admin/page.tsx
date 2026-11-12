import { Metadata } from 'next'
import { requireAdmin } from '@/modules/auth/server'
import { pageTitle } from '@/lib/utils/metadata'
import PageHeader from '@/components/ui/PageHeader'

export const metadata: Metadata = {
  title: pageTitle('Dashboard'),
  description: 'Admin dashboard',
}

export default async function DashboardPage() {
  await requireAdmin({});

  return (
    <div className="px-8 py-6 space-y-8">
      <PageHeader title="Dashboard" description="Operational summary of the generated catalogue estate." />
    </div>
  );
}
