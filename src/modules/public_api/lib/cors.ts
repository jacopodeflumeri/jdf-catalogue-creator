/**
 * Public API CORS Helpers
 */

import { NextResponse } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "X-API-Key, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Return the standard CORS headers for public API responses.
 */
export function corsHeaders(): Record<string, string> {
  return { ...CORS_HEADERS };
}

/**
 * Handle OPTIONS preflight requests.
 */
export function optionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
