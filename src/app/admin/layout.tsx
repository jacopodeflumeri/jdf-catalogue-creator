import { requireAdmin } from '@/modules/auth/server';
import { getCurrentUserMappTeamData } from '@/lib/actions/admin/admin-actions';
import AdminLayoutClient from '@/components/admin/layout/AdminLayoutClient';
import type { MappTeamResponse } from '@/types';
import logger from '@/lib/utils/logger';
import { prisma } from '@/lib/prisma/client';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication check
  await requireAdmin();
  
  // Fetch user profile server-side
  let userProfile: MappTeamResponse | null = null;
  const catalogNavigation = await prisma.syntheticCatalog.findMany({ where: { active: true }, select: { slug: true, name: true }, orderBy: [{ name: 'asc' }, { slug: 'asc' }] });
  
  try {
    userProfile = await getCurrentUserMappTeamData();
  } catch (error) {
    logger.error('Failed to fetch user profile in layout:', error);
    // Continue with null profile - layout should still render
  }
  
  return (
    <AdminLayoutClient userProfile={userProfile} catalogNavigation={catalogNavigation}>
      {children}
    </AdminLayoutClient>
  );
}
