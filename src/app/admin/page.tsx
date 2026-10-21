import { Metadata } from 'next'
import { requireAdmin } from '@/modules/auth/server'
import { pageTitle } from '@/lib/utils/metadata'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: pageTitle('Dashboard'),
  description: 'Admin dashboard',
}

export default async function DashboardPage() {
  await requireAdmin({});

  redirect('/admin/catalogs')
}
