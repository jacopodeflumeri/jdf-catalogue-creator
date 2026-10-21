/**
 * Customer Preview ("View as customer") — optional capability.
 * See docs/template/capabilities/CUSTOMER_PREVIEW.md.
 *
 * Three entry points, like the auth module:
 *   - `@/modules/customer_preview`         — THIS file: constants, the
 *     read-only guard (`assertNotPreview`, `isPreviewSession`) and pure
 *     helpers. No React, no Prisma, no server APIs: import it from anywhere,
 *     including every customer server action.
 *   - `@/modules/customer_preview/client`  — the UI: launcher, banner, notice.
 *   - `@/modules/customer_preview/server`  — the overlay, the subject seam,
 *     the start/options actions, the server-only `CustomerPreviewLaunch`.
 */
export {
  CUSTOMER_PREVIEW_COOKIE,
  CUSTOMER_PREVIEW_TTL_SECONDS,
  CUSTOMER_PREVIEW_END_PATH,
  CUSTOMER_PREVIEW_DEFAULT_RETURN_TO,
  CUSTOMER_PREVIEW_READ_ONLY_MESSAGE,
  CUSTOMER_PREVIEW_STATUSES,
  type CustomerPreviewStatus,
} from "./lib/constants";
export {
  assertNotPreview,
  isPreviewSession,
  CustomerPreviewReadOnlyError,
} from "./lib/guard";
export {
  formatPreviewEndTime,
  isCustomerPreviewStatus,
  sanitizePreviewReturnTo,
  withPreviewStatus,
} from "./lib/format";
export type { CustomerPreviewSessionInfo } from "@/modules/auth/types";
