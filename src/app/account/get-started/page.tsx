import type { Metadata } from "next";
import { getCustomerPageScope } from "@/modules/auth/server";
import { redirect } from "next/navigation";
import { pageTitle } from "@/lib/utils/metadata";

export const metadata: Metadata = {
  title: pageTitle("Get Started"),
  description: "Finish setting up your access",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

/**
 * Customer onboarding / "not eligible yet" page.
 *
 * The eligibility gate (requireEligibleCustomer) redirects ineligible
 * Company-Login customers here with a `reason`. The TEMPLATE default policy is
 * allow-all, so this page is normally unreachable — apps that install an
 * eligibility policy customize the copy + CTA per `reason`. We re-check
 * eligibility here and bounce eligible users back to /account so the page can't
 * become a dead end.
 */
export default async function GetStartedPage({ searchParams }: PageProps) {
  const { eligibility } = await getCustomerPageScope({ redirectTo: "/auth/admin" });
  if (eligibility.eligible) {
    redirect("/account");
  }

  const { reason } = await searchParams;

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center space-y-4 animate-fade-in">
        <h1 className="font-extrabold text-2xl tracking-tight text-[#1a1a1a]">
          Almost there
        </h1>
        <p className="text-sm text-[#1a1a1a]/65">
          Your account is signed in, but it isn&apos;t provisioned to use this
          app yet
          {reason ? ` (${reason})` : ""}. Please contact your Mapp representative
          to finish setup.
        </p>
      </div>
    </div>
  );
}
