import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { JWT } from 'next-auth/jwt';
import { getClientIP, isIPAllowed, isSuperAdminOnlyMode } from '@/lib/utils/security-restrictions';
import { logger } from './lib/utils/logger';
import { config as appConfig } from '@/config';
import {
  CUSTOMER_PREVIEW_COOKIE,
  allowsCustomerArea,
} from '@/modules/customer_preview/lib/constants';

// Extended JWT type with our custom fields
interface ExtendedJWT extends Omit<JWT, 'role'> {
  role?: 'customer' | 'admin';
  accountId?: string;
  email?: string;
  name?: string;
  isSuperAdmin?: boolean;
}

export default withAuth(
  async function proxy(req) {
    const token = req.nextauth.token as ExtendedJWT;
    const path = req.nextUrl.pathname;

    // Admin routes (pages and API)
    if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
      if (!token || token.role !== 'admin') {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/auth/signin?error=AdminRequired', req.url));
      }

      // Check IP restrictions for admin routes
      const clientIP = getClientIP(req);
      if (!isIPAllowed(clientIP)) {
        logger.warn(`Admin access blocked for IP: ${clientIP}`);
        if (path.startsWith('/api/')) {
          return NextResponse.json({ 
            error: 'Access denied from this IP address' 
          }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/auth/signin?error=IPRestricted', req.url));
      }

      // Check superadmin-only restriction
      if (isSuperAdminOnlyMode()) {
        if (!token.isSuperAdmin) {
          logger.warn(`Admin access blocked for non-superadmin: ${token.email}`);
          if (path.startsWith('/api/')) {
            return NextResponse.json({ 
              error: 'Superadmin access required' 
            }, { status: 403 });
          }
          return NextResponse.redirect(new URL('/auth/signin?error=SuperAdminRequired', req.url));
        }
      }
      
      // Employee access control check (for non-superadmins)
      if (!token.isSuperAdmin) {
        // Get admin data from token - we'll need to fetch fresh data
        // For now, check if they have basic access
        // Note: Full access control will be checked in server actions
        // This is just a basic gate to prevent completely unauthorized access
      }
    }

    // Customer routes (pages and API)
    if (path.startsWith('/account') || path.startsWith('/api/account')) {
      if (!token) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/auth/signin?error=AuthRequired', req.url));
      }
      
      const allowed = allowsCustomerArea({
        role: token.role,
        accountId: token.accountId,
        isApi: path.startsWith('/api/'),
        previewEnabled: appConfig.customerPreview.enabled,
        hasPreviewCookie: req.cookies.has(CUSTOMER_PREVIEW_COOKIE),
      });

      if (!allowed) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Customer access or admin account view required' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/auth/signin?error=CustomerRequired', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Since we're only matching specific protected routes, we just need to check if a token exists
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/account/:path*',
    '/api/admin/:path*',
    '/api/account/:path*',
    // Note: /api/images is intentionally excluded - it resolves its own access
    // level from the S3 prefix policy (src/modules/s3_images/config/prefixes.ts):
    // public/ reads are anonymous, every other prefix needs a session.
  ],
};
