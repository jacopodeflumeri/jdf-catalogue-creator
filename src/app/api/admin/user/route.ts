import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/modules/auth/server';
import { getAdminUserProfile, updateAdminUserProfile } from '@/lib/actions/admin/admin-actions';

/**
 * GET /api/admin/user
 * Fetch admin user profile
 */
export const GET = withAdminAuth(async (request: NextRequest, { searchParams }) => {
  const email = searchParams.get('email') || undefined;
  const userProfile = await getAdminUserProfile(email);
  return NextResponse.json(userProfile);
});

/**
 * PUT /api/admin/user
 * Update admin user profile
 */
export const PUT = withAdminAuth(async (request: NextRequest) => {
  const profileData = await request.json();
  const result = await updateAdminUserProfile(profileData);
  return NextResponse.json(result);
});
