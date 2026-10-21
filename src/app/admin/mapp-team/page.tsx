import { Metadata } from 'next'
import { requireAdmin } from '@/modules/auth/server'
import { getMappTeamData } from '@/lib/actions/admin/admin-actions'
import AdminMappTeamClient from './client'
import { pageTitle } from '@/lib/utils/metadata'

export const metadata: Metadata = {
  title: pageTitle('Mapp Team'),
  description: 'Manage and view all Mapp team members',
}

export default async function MappTeamPage() {
  // Server-side admin authentication
  const session = await requireAdmin({ requireAdminAccess: true, redirectTo: '/admin' });

  // Fetch Mapp team data server-side
  const teamData = await getMappTeamData();

  return (
    <AdminMappTeamClient 
      initialData={teamData}
      currentUserId={session.user.adminId || ''}
    />
  )
}
