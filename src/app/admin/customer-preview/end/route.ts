/**
 * GET /admin/customer-preview/end — ends an admin "View as customer" preview.
 * The handler lives in the customer_preview module; see its end-route.ts.
 */
import type { NextRequest } from "next/server";
import { endCustomerPreview } from "@/modules/customer_preview/server/end-route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return endCustomerPreview(request);
}
