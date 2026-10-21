import Link from "next/link";
import type { Session } from "next-auth";
import AppIdentity from "@/components/shared/layout/AppBranding";
import {
  CUSTOMER_PREVIEW_END_PATH,
  CustomerPreviewBanner,
} from "@/modules/customer_preview/client";

/**
 * Minimal chrome for Company-Login (Mapp Cloud) customers.
 *
 * Company customers have NO local Account/User, so they must NOT be routed
 * through the legacy account-based customer layout (which fetches a customer
 * profile, runs the account-disabled check, and renders the dashboard/settings/
 * team nav). This is the safe baseline shell: app name + signed-in identity +
 * federated sign-out. Apps that build a company-customer experience replace the
 * children (see /account/page.tsx) and extend this nav as needed.
 *
 * "View as customer" (optional customer_preview capability): `session` is the
 * SERVER session from `requireCustomer`, which during a preview is the
 * synthesized customer session — the browser's own `useSession()` is still
 * the admin's. So this layout (and any nav you add) must decide from `session`,
 * never from `useSession()`. During a preview it shows the banner, and swaps
 * Sign out for Exit preview: signing out here would sign the ADMIN out.
 */
export default function CompanyCustomerLayout({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const name = session.user.name || session.user.email || "Account";
  const preview = session.user.customerPreview ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F1ECE3]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/60">
        <Link href="/account" className="min-w-0">
          <AppIdentity />
        </Link>
        <div className="flex items-center gap-3 text-sm text-[#1a1a1a]/70">
          <span className="hidden sm:inline">{name}</span>
          {preview ? (
            // Plain <a>: the end route is a route handler, not a page.
            <a
              href={CUSTOMER_PREVIEW_END_PATH}
              className="rounded-lg border border-white/85 bg-[rgba(255,255,255,0.5)] px-3 py-1.5 font-medium text-[#1a1a1a] transition-colors hover:bg-white/70"
            >
              Exit preview
            </a>
          ) : (
            <Link
              href="/auth/signout"
              className="rounded-lg border border-white/85 bg-[rgba(255,255,255,0.5)] px-3 py-1.5 font-medium text-[#1a1a1a] transition-colors hover:bg-white/70"
            >
              Sign out
            </Link>
          )}
        </div>
      </header>
      {preview && <CustomerPreviewBanner preview={preview} />}
      {/*
        A flex column, so a page (or the /account loading skeleton) can fill
        the remaining height with flex-1 — e.g. to centre its content.
      */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
