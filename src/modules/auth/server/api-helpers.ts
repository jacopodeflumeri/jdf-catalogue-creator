/**
 * API Route Authentication Helpers
 * 
 * This module provides Higher-Order Functions (HOFs) that wrap API route handlers
 * with authentication logic. They handle session validation and return proper
 * HTTP error responses when authentication fails.
 * 
 * Benefits:
 * - Clean, declarative API route protection
 * - Automatic error handling
 * - Type-safe session context
 * - No redirect behavior (returns JSON errors)
 * - Reduces boilerplate in API routes
 * 
 * @example Admin API Route
 * ```typescript
 * import { withAdminAuth } from '@/modules/auth';
 * 
 * export const GET = withAdminAuth(async (request, { session }) => {
 *   return Response.json({ 
 *     admin: session.user.email,
 *     data: 'protected' 
 *   });
 * });
 * ```
 * 
 * @example Customer API Route
 * ```typescript
 * import { withCustomerAuth } from '@/modules/auth';
 * 
 * export const POST = withCustomerAuth(async (request, { session }) => {
 *   const accountId = session.user.accountId;
 *   // Process customer request
 *   return Response.json({ success: true });
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, getCustomerSession } from './require-auth';
import type { Session } from 'next-auth';
import logger from '@/lib/utils/logger';

/**
 * API Handler Type Definition
 * 
 * Defines the signature for API route handlers that are wrapped
 * with authentication middleware.
 * 
 * @template T - Response data type
 */
export type ApiHandler<T = any> = (
  request: NextRequest,
  context: {
    /** Authenticated NextAuth session */
    session: Session;
    /** URL search parameters for convenience */
    searchParams: URLSearchParams;
  }
) => Promise<NextResponse<T>>;

/**
 * Admin Authentication Wrapper for API Routes
 * 
 * Wraps an API route handler with admin authentication. Validates that the
 * request is from an authenticated admin user. Returns 401 if not authenticated.
 * 
 * Features:
 * - Automatic session validation
 * - IP restriction enforcement
 * - Super admin mode support
 * - Error handling with JSON responses
 * - Search params parsed and provided
 * 
 * @param handler - The API route handler to wrap
 * @returns Wrapped handler with authentication
 * 
 * @example Basic admin API route
 * ```typescript
 * export const GET = withAdminAuth(async (request, { session }) => {
 *   return Response.json({ 
 *     message: 'Admin only data',
 *     admin: session.user.email
 *   });
 * });
 * ```
 * 
 * @example POST with request body
 * ```typescript
 * export const POST = withAdminAuth(async (request, { session }) => {
 *   const body = await request.json();
 *   
 *   // Process admin request
 *   const result = await processAdminAction(body, session.user.adminId);
 *   
 *   return Response.json({ success: true, result });
 * });
 * ```
 * 
 * @example Using search params
 * ```typescript
 * export const GET = withAdminAuth(async (request, { session, searchParams }) => {
 *   const accountId = searchParams.get('accountId');
 *   
 *   if (!accountId) {
 *     return Response.json({ error: 'accountId required' }, { status: 400 });
 *   }
 *   
 *   const data = await getAccountData(accountId);
 *   return Response.json(data);
 * });
 * ```
 */
export const withAdminAuth = (handler: ApiHandler) => {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getAdminSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - Admin access required' }, 
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);

      return await handler(request, {
        session,
        searchParams
      });
    } catch (error) {
      logger.error('Admin API error:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };
};

/**
 * Customer Authentication Wrapper for API Routes
 * 
 * Wraps an API route handler with customer authentication. Validates that the
 * request is from an authenticated customer user with a selected account.
 * Returns 401 if not authenticated.
 * 
 * Features:
 * - Automatic session validation
 * - Account ID validation
 * - Error handling with JSON responses
 * - Search params parsed and provided
 * 
 * @param handler - The API route handler to wrap
 * @returns Wrapped handler with authentication
 * 
 * @example Basic customer API route
 * ```typescript
 * export const GET = withCustomerAuth(async (request, { session }) => {
 *   const accountId = session.user.accountId;
 *   const data = await getCustomerData(accountId);
 *   
 *   return Response.json(data);
 * });
 * ```
 * 
 * @example POST with validation
 * ```typescript
 * export const POST = withCustomerAuth(async (request, { session }) => {
 *   const body = await request.json();
 *   const accountId = session.user.accountId;
 *   
 *   // Validate customer owns the resource
 *   if (body.accountId !== accountId) {
 *     return Response.json(
 *       { error: 'Forbidden - Account mismatch' }, 
 *       { status: 403 }
 *     );
 *   }
 *   
 *   await processCustomerAction(body);
 *   return Response.json({ success: true });
 * });
 * ```
 * 
 * @example With error handling
 * ```typescript
 * export const PUT = withCustomerAuth(async (request, { session, searchParams }) => {
 *   const id = searchParams.get('id');
 *   
 *   try {
 *     const result = await updateCustomerResource(id, session.user.accountId);
 *     return Response.json(result);
 *   } catch (error) {
 *     return Response.json(
 *       { error: 'Update failed', details: error.message }, 
 *       { status: 400 }
 *     );
 *   }
 * });
 * ```
 */
export const withCustomerAuth = (handler: ApiHandler) => {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getCustomerSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - Customer access required' }, 
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);

      return await handler(request, {
        session,
        searchParams
      });
    } catch (error) {
      logger.error('Customer API error:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };
};

/**
 * Generic Authentication Wrapper for API Routes
 * 
 * Wraps an API route handler with either admin or customer authentication.
 * More flexible than specific wrappers, but less type-safe. Use specific
 * wrappers (withAdminAuth, withCustomerAuth) when possible.
 * 
 * @param handler - The API route handler to wrap
 * @param requireAdmin - Whether to require admin authentication
 * @returns Wrapped handler with authentication
 * 
 * @example Admin-only with generic wrapper
 * ```typescript
 * export const GET = withAuth(async (request, { session }) => {
 *   return Response.json({ data: 'admin only' });
 * }, true);
 * ```
 * 
 * @example Customer with generic wrapper
 * ```typescript
 * export const POST = withAuth(async (request, { session }) => {
 *   // Works for customers
 *   return Response.json({ accountId: session.user.accountId });
 * }, false);
 * ```
 */
export const withAuth = (handler: ApiHandler, requireAdmin: boolean = false) => {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = requireAdmin 
        ? await getAdminSession()
        : await getCustomerSession();
      
      if (!session) {
        return NextResponse.json(
          { error: `Unauthorized - ${requireAdmin ? 'Admin' : 'Customer'} access required` }, 
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);

      return await handler(request, {
        session,
        searchParams
      });
    } catch (error) {
      logger.error('API auth error:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  };
};
