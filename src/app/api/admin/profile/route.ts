/**
 * API Route: Admin Profile
 * GET /api/admin/profile - Get current admin user's profile data
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/modules/auth/server';
import { getAdminUserProfile } from '@/lib/actions/admin/admin-actions';
import logger from '@/lib/utils/logger';

export const GET = withAdminAuth(async (_request: NextRequest, { session }) => {
  try {
    if (!session.user.email) {
      return NextResponse.json(
        { error: 'User email not found in session' },
        { status: 400 }
      );
    }

    const userData = await getAdminUserProfile(session.user.email);
    
    if (!userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile: userData });
  } catch (error) {
    logger.error('Error fetching admin profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
});
