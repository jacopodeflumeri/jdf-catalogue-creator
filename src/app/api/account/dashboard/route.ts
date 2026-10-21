import { NextRequest, NextResponse } from 'next/server';
import { withCustomerAuth } from '@/modules/auth/server';
import { getCustomerDashboardData } from '@/lib/actions/account/account-actions';

/**
 * GET /api/account/dashboard
 * Fetch customer dashboard data
 */
export const GET = withCustomerAuth(async (_request: NextRequest) => {
  const dashboardData = await getCustomerDashboardData();
  return NextResponse.json(dashboardData);
});
