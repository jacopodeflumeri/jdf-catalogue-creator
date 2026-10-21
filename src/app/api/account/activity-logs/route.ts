import { NextRequest, NextResponse } from 'next/server';
import { withCustomerAuth } from '@/modules/auth/server';
import { accountActivity, getAccountActivityLogs } from '@/lib/actions/admin/activity-actions';

/**
 * GET /api/activity-logs
 * Fetch activity logs for the current user's account
 */
export const GET = withCustomerAuth(async (_request: NextRequest) => {
  const logs = await getAccountActivityLogs();
  return NextResponse.json(logs || []);
});

/**
 * POST /api/activity-logs
 * Create a new activity log entry
 */
export const POST = withCustomerAuth(async (request: NextRequest) => {
  const body = await request.json();
  const { type, details, message, linked_id } = body;

  // Validate required fields
  if (!type || !details || !message) {
    return NextResponse.json(
      { error: 'Missing required fields: type, details, message' }, 
      { status: 400 }
    );
  }

  const result = await accountActivity({
    type,
    details,
    message,
    linked_id,
  });

  if (result.success) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json(
      { error: result.error || 'Failed to log activity' }, 
      { status: 500 }
    );
  }
});
