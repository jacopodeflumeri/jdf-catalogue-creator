/**
 * Company → local Account resolution seam (APP-SPECIFIC, pluggable).
 *
 * A Company-Login customer arrives with a client-catalog `companyId`. Whether
 * that maps to a local `Account` row — and how — is entirely app-specific:
 *
 *   - The TEMPLATE default returns `null`: the base schema has no company→account
 *     mapping, so a CompanyUser is stored unlinked (still fully usable for
 *     identity + attribution; the FK is simply null).
 *
 *   - An app that DOES map companies to accounts overrides this function. For
 *     example, FTL stores the client-catalog company id on `Account`
 *     (`clientCatalogCompanyId`) and resolves it directly:
 *
 *       export async function resolveAccountIdForCompany(companyId: number) {
 *         const account = await prisma.account.findUnique({
 *           where: { clientCatalogCompanyId: companyId },
 *           select: { id: true },
 *         });
 *         return account?.id ?? null;
 *       }
 *
 * Keeping this as a one-function seam means the generic CompanyUser service and
 * the auth callbacks never need to know an app's company-identity columns.
 */

/**
 * Resolve the local Account id for a client-catalog company id, or `null` when
 * there is no mapping. Re-evaluated on every login, so a company that gets
 * onboarded later links up automatically.
 */
export async function resolveAccountIdForCompany(
  _companyId: number,
): Promise<number | null> {
  // Template default: no company→account mapping. Override per app.
  return null;
}
