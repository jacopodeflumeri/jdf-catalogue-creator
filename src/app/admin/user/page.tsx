import { Metadata } from 'next'
import { requireAdmin } from '@/modules/auth/server'
import { getCurrentUserMappTeamData } from '@/lib/actions/admin/admin-actions'
import AdminUserClient from './client'
import { pageTitle } from '@/lib/utils/metadata'

export const metadata: Metadata = {
  title: pageTitle('User Profile'),
  description: 'Manage and view all user account settings',
}

export default async function UserPage() {
  // Server-side admin authentication
  await requireAdmin({});

  // Fetch current user's profile data server-side
  const userProfile = await getCurrentUserMappTeamData();

  return (
    <AdminUserClient 
      initialData={userProfile}
    />
  )
}
