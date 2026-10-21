import type { Session } from "next-auth";
import type { CompanyContext } from "@/modules/auth/server";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

/**
 * Safe baseline landing for a Company-Login (Mapp Cloud) customer.
 *
 * The template doesn't ship an app-specific company-customer experience — that's
 * what each app builds. This is the minimal, crash-free home so a company login
 * lands somewhere sane (instead of the legacy account dashboard, which assumes a
 * local Account/User). It shows the resolved company context + the entitled
 * service codes from the session. Replace the body with your app's UI.
 */
export default function CompanyCustomerHome({
  session,
  context,
}: {
  session: Session;
  context: CompanyContext;
}) {
  const displayName = session.user.name || session.user.email || "there";
  const company =
    context.accountName ??
    (context.companyId ? `Company ${context.companyId}` : "your company");

  // Distinct entitled service codes across the user's workspaces.
  const services = Array.from(
    new Set(
      (session.user.workspaces ?? []).flatMap((w) => w.services ?? []),
    ),
  ).sort();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-6">
      <PageHeader
        size="compact"
        title={`Welcome, ${displayName}`}
        description={`You're signed in with company context for ${company}.`}
      />

      <Card>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#1a1a1a]/55">Company</span>
            <span className="font-medium text-[#1a1a1a]">{company}</span>
          </div>
          {context.companyId && (
            <div className="flex justify-between gap-4">
              <span className="text-[#1a1a1a]/55">Company ID</span>
              <span className="font-mono text-[#1a1a1a]/80">
                {context.companyId}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-[#1a1a1a]/55">Entitlements</span>
            <span className="text-right text-[#1a1a1a]/80">
              {services.length > 0 ? services.join(", ") : "—"}
            </span>
          </div>
        </div>
      </Card>

      <p className="text-xs text-[#1a1a1a]/45">
        This is the template&apos;s baseline company-customer landing. Build your
        app&apos;s experience in <code>src/app/account/CompanyCustomerHome.tsx</code>.
      </p>
    </div>
  );
}
