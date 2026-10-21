/**
 * Public API Key Authentication
 *
 * HOF wrapper for API route handlers, following the same pattern
 * as withAdminAuth in src/modules/auth/server/api-helpers.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { config } from "@/config";
import logger from "@/lib/utils/logger";
import { errorResponse } from "./response";
import { corsHeaders } from "./cors";
import { API_KEY_HEADER } from "./cache";

export type ApiKeyContext = {
  apiKey: {
    id: number;
    name: string;
    accountId: number | null;
  };
  searchParams: URLSearchParams;
};

export type ApiKeyHandler<T = unknown> = (
  request: NextRequest,
  context: ApiKeyContext,
) => Promise<NextResponse<T>>;

export interface ApiKeyAuthOptions {
  /** If true, reject account-scoped API keys (accountId != null). */
  requireInternal?: boolean;
}

/**
 * Wrap an API route handler with API key authentication.
 *
 * Reads the `X-API-Key` header, validates against the database,
 * checks active status and expiry, then passes the key record
 * to the handler.
 */
export function withApiKeyAuth(
  handler: ApiKeyHandler,
  options?: ApiKeyAuthOptions,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const key = request.headers.get(API_KEY_HEADER);

      if (!key) {
        return errorResponse("UNAUTHORIZED", "Missing API key", 401);
      }

      const apiKey = await (prisma as any).apiKey.findUnique({
        where: { key },
        select: {
          id: true,
          name: true,
          active: true,
          environment: true,
          expiresAt: true,
          accountId: true,
        },
      });

      if (!apiKey) {
        return errorResponse("UNAUTHORIZED", "Invalid API key", 401);
      }

      if (!apiKey.active) {
        return errorResponse("UNAUTHORIZED", "API key is inactive", 401);
      }

      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        return errorResponse("UNAUTHORIZED", "API key has expired", 401);
      }

      const currentEnv = config.app.environment ?? "development";
      if (apiKey.environment !== currentEnv) {
        return errorResponse(
          "UNAUTHORIZED",
          "API key is not valid for this environment",
          401,
        );
      }

      // Gate: internal-only endpoints reject account-scoped keys
      if (options?.requireInternal && apiKey.accountId != null) {
        return errorResponse(
          "FORBIDDEN",
          "This endpoint is not available for account-scoped API keys",
          403,
        );
      }

      // Update lastUsedAt (fire-and-forget, don't block the response)
      (prisma as any).apiKey
        .update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        })
        .catch((err: unknown) => {
          logger.warn("Failed to update API key lastUsedAt:", err);
        });

      const { searchParams } = new URL(request.url);

      const response = await handler(request, {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          accountId: apiKey.accountId,
        },
        searchParams,
      });

      // Add CORS headers to every response
      const headers = corsHeaders();
      for (const [k, v] of Object.entries(headers)) {
        response.headers.set(k, v);
      }

      return response;
    } catch (error) {
      logger.error("Public API error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "An unexpected error occurred",
        500,
      );
    }
  };
}
