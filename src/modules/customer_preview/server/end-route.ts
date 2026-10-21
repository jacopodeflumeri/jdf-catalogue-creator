/**
 * End a "View as customer" preview: clear the cookie, audit it (only when it
 * was genuinely this admin's live preview), and go back to where it started.
 *
 * Served as GET `/admin/customer-preview/end` (src/app/admin/customer-preview/
 * end/route.ts). A GET route rather than a server action because two things
 * need it: the banner's Exit link (a plain `<a>`), and `requireCustomer`, which
 * sends an admin here when their preview cookie no longer verifies, so a dead
 * cookie is cleared instead of lingering. Under `/admin`, so the proxy already
 * requires an admin session. Ending a preview is harmless, which is why a link
 * may trigger it. It works with the capability OFF too, so a stale cookie can
 * always be cleared.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/auth/config/nextauth";
import { sessionAuditActor, writeAuditLog } from "@/modules/audit";
import { CUSTOMER_PREVIEW_COOKIE, CUSTOMER_PREVIEW_DEFAULT_RETURN_TO } from "../lib/constants";
import { sanitizePreviewReturnTo, withPreviewStatus } from "../lib/format";
import { readCustomerPreviewToken } from "../lib/token";
import { customerPreviewSecret } from "./resolve";

export async function endCustomerPreview(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const token = request.cookies.get(CUSTOMER_PREVIEW_COOKIE)?.value;
  // Signature-checked, expiry ignored: an expired preview still says where to
  // go back to. Only an unexpired one is audited.
  const claims = readCustomerPreviewToken(token, customerPreviewSecret());

  const adminEmail = (session?.user?.email ?? "").toLowerCase();
  const own =
    session?.user?.role === "admin" &&
    !!claims &&
    !!adminEmail &&
    claims.adminEmail === adminEmail;

  // Audit only a preview that was this admin's and still running; clearing an
  // expired, forged or someone else's cookie is housekeeping, not an event.
  if (own && claims.exp > Date.now()) {
    await writeAuditLog({
      ...sessionAuditActor(session),
      action: "customer_preview_end",
      entityType: "company",
      entityId: claims.subject,
      message: `Stopped viewing company ${claims.subject} as a customer`,
      data: { companyId: claims.subject },
    });
  }

  const param = request.nextUrl.searchParams.get("reason");
  const status = param === "ended" || param === "unavailable" ? param : "exited";
  // Someone else's cookie must not choose where this admin lands.
  const returnTo = own
    ? sanitizePreviewReturnTo(claims.returnTo)
    : CUSTOMER_PREVIEW_DEFAULT_RETURN_TO;

  // A RELATIVE Location, deliberately. Behind the load balancer `request.url`
  // is the container's own address (e.g. https://0.0.0.0:3000/...), so an
  // absolute URL built from it sends the admin to an unreachable host. The
  // browser resolves a relative Location against the URL it actually used.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: withPreviewStatus(returnTo, status) },
  });
  response.cookies.delete(CUSTOMER_PREVIEW_COOKIE);
  return response;
}
