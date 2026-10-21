import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/auth/config/nextauth";
import { canStartCustomerPreview } from "../server/resolve";
import CustomerPreviewLauncher, {
  type CustomerPreviewLauncherProps,
} from "./CustomerPreviewLauncher";

/**
 * SERVER component: the "View as customer" launch point for any admin page.
 * Renders nothing unless the capability is on and the signed-in admin may
 * preview (admin level or SuperAdmin) — so dropping it into a page needs no
 * other check. Import from `@/modules/customer_preview/server`.
 *
 *   <CustomerPreviewLaunch companyId={company.clientCatalogCompanyId}
 *     companyName={company.name} workspaces={[{ id, name }, …]} />
 */
export default async function CustomerPreviewLaunch(
  props: Omit<CustomerPreviewLauncherProps, "allowed">,
) {
  const session = await getServerSession(authOptions);
  if (!canStartCustomerPreview(session)) return null;
  return <CustomerPreviewLauncher allowed {...props} />;
}
