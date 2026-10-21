import { Metadata } from 'next'
import { requireAdmin } from '@/modules/auth/server'
import { pageTitle } from '@/lib/utils/metadata'

export const metadata: Metadata = {
  title: pageTitle('Dashboard'),
  description: 'Admin dashboard',
}

export default async function DashboardPage() {
  // Server-side admin authentication with auto session return
  await requireAdmin({});

  // The base template ships an empty admin dashboard — add your app's overview
  // here. (The accounts/companies admin moved into the client_catalog capability
  // scaffold; see src/modules/client_catalog/scaffold/ and docs/template/ROUTING.md.)
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-gray-500">
        Welcome. Build your admin dashboard here.
      </p>
    </div>
  )
}
