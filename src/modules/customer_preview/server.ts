/**
 * Customer Preview ("View as customer") — SERVER exports.
 * See docs/template/capabilities/CUSTOMER_PREVIEW.md.
 *
 * Do not import this from client components; use `@/modules/customer_preview`
 * (guard, constants) or `@/modules/customer_preview/client` (UI).
 */
export * from "./client";

export {
  isCustomerPreviewEnabled,
  canPreviewAsCustomer,
  canStartCustomerPreview,
  buildCustomerPreviewSession,
  resolveCustomerPreview,
  customerPreviewSecret,
  type CustomerPreviewResolution,
  type CustomerPreviewInvalidReason,
} from "./server/resolve";
export {
  startCustomerPreviewAction,
  getCustomerPreviewOptionsAction,
  type StartCustomerPreviewInput,
  type CustomerPreviewOptionsResult,
} from "./server/actions";
export { getPreviewSubject, clearPreviewSubjectCache } from "./server/subject-cache";
export {
  resolvePreviewSubject,
  type PreviewSubject,
  type PreviewSubjectWorkspace,
} from "./config/subject";
export {
  createCustomerPreviewToken,
  verifyCustomerPreviewToken,
  readCustomerPreviewToken,
  type CustomerPreviewClaims,
} from "./lib/token";
export { default as CustomerPreviewLaunch } from "./components/CustomerPreviewLaunch";
