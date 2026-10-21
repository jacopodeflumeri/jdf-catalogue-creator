import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/modules/auth/server';
import { getAdminDashboardData } from '@/lib/actions/admin/admin-actions';

/**
 * GET /api/admin/dashboard
 * Fetch admin dashboard data
 */
export const GET = withAdminAuth(async (_request: NextRequest) => {
  const dashboardData = await getAdminDashboardData();
  return NextResponse.json(dashboardData);
});
